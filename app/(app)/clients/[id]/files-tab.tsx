"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FileUpload } from "@/components/ui/file-upload";
import { IconSquare } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import type { FileKind, FileRecord } from "@/lib/types";

// Files tab — FileUpload dropzone (→ POST /api/files, bytes to ./uploads)
// over a grid of file tiles.

const KIND_LABELS: Record<FileKind, { label: string; variant: "neutral" | "info" | "warning" }> = {
  upload: { label: "Upload", variant: "neutral" },
  form_pdf: { label: "Form PDF", variant: "info" },
  superbill: { label: "Superbill", variant: "warning" },
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function FilesTab({
  clientId,
  files,
  readOnly = false,
  bare = false,
}: {
  clientId: string;
  files: FileRecord[];
  /** Patient-portal variant: the dropzone goes, the tiles stay. */
  readOnly?: boolean;
  /** Board variant: the host card owns the width, so drop the page measure and
   *  let the tiles reflow inside whatever column the card is. */
  bare?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("clientId", clientId);
      const res = await fetch("/api/files", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error ?? "Upload failed.", "danger");
        return;
      }
      toast(
        <>
          <b>{file.name}</b> uploaded
        </>,
        "success",
      );
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={bare ? "" : "max-w-4xl"}>
      {readOnly ? null : uploading ? (
        <div className="flex items-center justify-center gap-3 rounded-field border-2 border-dashed border-primary-weak bg-teal-100/50 px-6 py-8 text-[15px] text-text-body">
          <Spinner size={18} /> Uploading…
        </div>
      ) : (
        <FileUpload onFile={upload} constraints="PDF, PNG or JPG · max 10 MB" />
      )}

      {files.length === 0 ? (
        <EmptyState
          icon="file-up"
          title="No files yet"
          subtext={
            readOnly
              ? "Documents your practice shares with you will appear here."
              : "Uploads, generated form PDFs and superbills will appear here."
          }
        />
      ) : (
        <div className={`grid gap-4 sm:grid-cols-2 ${bare ? "" : "lg:grid-cols-3"} ${readOnly ? "" : "mt-6"}`}>
          {files.map((f) => {
            const kind = KIND_LABELS[f.kind];
            return (
              <div key={f.id} className="rounded-card border border-border bg-surface p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <IconSquare name="file-text" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-text" title={f.name}>
                      {f.name}
                    </div>
                    <div className="mt-0.5 text-[13px] text-text-muted">
                      {formatBytes(f.sizeBytes)} · {formatDate(f.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <Badge variant={kind.variant}>{kind.label}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
