"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Native-WebRTC call hook for 1-on-1 telehealth over /api/signal.
//
// Negotiation ("perfect negotiation"-lite): join replies with the peers
// already in the room — if someone is there you create the offer, otherwise
// you wait for theirs. The route registers joins atomically, so exactly one
// side ever sees the other and glare can't happen. Events are exchanged by
// polling the signaling queue every second.

export type CallStatus = "lobby" | "waiting" | "connecting" | "connected" | "ended";

interface SignalEvent {
  seq: number;
  type: "join" | "leave" | "offer" | "answer" | "candidate";
  from: string;
  payload: unknown;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const POLL_MS = 1000;

function randomPeerId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

export function useWebRTC(room: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CallStatus>("lobby");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [peerId] = useState(randomPeerId); // stable per mount
  const peerIdRef = useRef(peerId);

  const localRef = useRef<MediaStream | null>(null);
  const displayRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const joinedRef = useRef(false);
  const sinceRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollBusyRef = useRef(false);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const startedRef = useRef(false);

  // ── camera/mic preview (runs from mount so the lobby has a live tile) ──────
  useEffect(() => {
    let cancelled = false;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMediaError("This browser does not support camera/microphone capture.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localRef.current = stream;
        setLocalStream(stream);
      })
      .catch(() => {
        if (!cancelled) setMediaError("Camera and microphone unavailable — check browser permissions.");
      });
    return () => {
      cancelled = true;
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
    };
  }, []);

  // ── signaling ──────────────────────────────────────────────────────────────
  const post = useCallback(
    async (type: SignalEvent["type"], payload?: unknown): Promise<{ peers?: string[] } | null> => {
      try {
        const res = await fetch("/api/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room, peerId: peerIdRef.current, type, payload }),
        });
        return res.ok ? ((await res.json()) as { peers?: string[] }) : null;
      } catch {
        return null;
      }
    },
    [room],
  );

  const markConnected = useCallback(() => {
    setStatus("connected");
    if (!startedRef.current) {
      startedRef.current = true;
      setStartedAt(Date.now());
    }
  }, []);

  const createPeer = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;
    const stream = localRef.current;
    if (stream) {
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
      // keep screen-share live if it was toggled before (re)negotiation
      const shareTrack = displayRef.current?.getVideoTracks()[0];
      if (shareTrack) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        void sender?.replaceTrack(shareTrack);
      }
    } else {
      // no capture permission — still join receive-only
      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.addTransceiver("video", { direction: "recvonly" });
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) void post("candidate", e.candidate.toJSON());
    };
    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0] ?? new MediaStream([e.track]));
      markConnected();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") markConnected();
      else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setRemoteStream(null);
        setStatus((s) => (s === "ended" ? s : "waiting"));
      }
    };
    return pc;
  }, [post, markConnected]);

  const flushCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const c of pending) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        // stale candidate from a torn-down connection — ignore
      }
    }
  }, []);

  const makeOffer = useCallback(async () => {
    const pc = pcRef.current ?? createPeer();
    setStatus("connecting");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await post("offer", pc.localDescription);
  }, [createPeer, post]);

  const handleEvent = useCallback(
    async (ev: SignalEvent) => {
      if (ev.type === "leave") {
        pcRef.current?.close();
        pcRef.current = null;
        pendingCandidatesRef.current = [];
        setRemoteStream(null);
        setStatus((s) => (s === "ended" ? s : "waiting"));
        return;
      }
      if (ev.type === "join") return; // the newcomer saw us and will send the offer
      const pc = pcRef.current ?? createPeer();
      try {
        if (ev.type === "offer") {
          setStatus("connecting");
          await pc.setRemoteDescription(ev.payload as RTCSessionDescriptionInit);
          await flushCandidates(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await post("answer", pc.localDescription);
        } else if (ev.type === "answer") {
          await pc.setRemoteDescription(ev.payload as RTCSessionDescriptionInit);
          await flushCandidates(pc);
        } else if (ev.type === "candidate") {
          const candidate = ev.payload as RTCIceCandidateInit;
          if (pc.remoteDescription) await pc.addIceCandidate(candidate);
          else pendingCandidatesRef.current.push(candidate);
        }
      } catch {
        // negotiation hiccup (e.g. peer refreshed mid-handshake) — the other
        // side re-offers on rejoin, so drop the event rather than crash
      }
    },
    [createPeer, flushCandidates, post],
  );

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      if (pollBusyRef.current || !joinedRef.current) return;
      pollBusyRef.current = true;
      try {
        const res = await fetch(
          `/api/signal?room=${encodeURIComponent(room)}&peerId=${peerIdRef.current}&since=${sinceRef.current}`,
        );
        if (res.ok) {
          const data = (await res.json()) as { events: SignalEvent[] };
          for (const ev of data.events) {
            sinceRef.current = Math.max(sinceRef.current, ev.seq);
            await handleEvent(ev);
          }
        }
      } catch {
        // transient network error — next tick retries
      } finally {
        pollBusyRef.current = false;
      }
    }, POLL_MS);
  }, [room, handleEvent, stopPolling]);

  // ── public API ─────────────────────────────────────────────────────────────
  const join = useCallback(async () => {
    if (joinedRef.current) return;
    joinedRef.current = true;
    setStatus("waiting");
    const res = await post("join");
    const others = res?.peers ?? [];
    createPeer();
    startPolling();
    if (others.length > 0) await makeOffer(); // second joiner offers; first waits
  }, [post, createPeer, startPolling, makeOffer]);

  const teardown = useCallback(() => {
    stopPolling();
    if (joinedRef.current) {
      joinedRef.current = false;
      void post("leave");
    }
    pcRef.current?.close();
    pcRef.current = null;
    pendingCandidatesRef.current = [];
    displayRef.current?.getTracks().forEach((t) => t.stop());
    displayRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
  }, [post, stopPolling]);

  const leave = useCallback(() => {
    teardown();
    setRemoteStream(null);
    setDisplayStream(null);
    setSharing(false);
    setStatus("ended");
  }, [teardown]);

  useEffect(() => teardown, [teardown]); // page unmount = hang up

  const toggleMic = useCallback(() => {
    setMicOn((on) => {
      localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !on));
      return !on;
    });
  }, []);

  const toggleCam = useCallback(() => {
    setCamOn((on) => {
      localRef.current?.getVideoTracks().forEach((t) => (t.enabled = !on));
      return !on;
    });
  }, []);

  const stopShare = useCallback(() => {
    const cam = localRef.current?.getVideoTracks()[0] ?? null;
    const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
    if (sender) void sender.replaceTrack(cam);
    displayRef.current?.getTracks().forEach((t) => t.stop());
    displayRef.current = null;
    setDisplayStream(null);
    setSharing(false);
  }, []);

  const toggleShare = useCallback(async () => {
    if (displayRef.current) {
      stopShare();
      return;
    }
    try {
      const ds = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = ds.getVideoTracks()[0];
      if (!track) return;
      displayRef.current = ds;
      setDisplayStream(ds);
      setSharing(true);
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(track);
      track.onended = stopShare; // browser "Stop sharing" chrome
    } catch {
      // user dismissed the share picker — no-op
    }
  }, [stopShare]);

  return {
    peerId,
    status,
    startedAt,
    localStream,
    displayStream,
    remoteStream,
    micOn,
    camOn,
    sharing,
    mediaError,
    join,
    leave,
    toggleMic,
    toggleCam,
    toggleShare,
  };
}
