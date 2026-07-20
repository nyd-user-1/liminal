"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { FileUpload } from "@/components/ui/file-upload";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SearchInput } from "@/components/ui/search-input";
import { Tag, type TagHue } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import type { FileKind, FileRecord } from "@/lib/types";

// Documents — the client record's real file list. FileUpload gives both a
// drag-drop zone and a picker; bytes POST to /api/files (private Blob, or
// ./uploads in local dev) and every download goes back out through the
// authenticated proxy at /api/files/download, never a blob URL.
//
// Upload progress is MEASURED, not mimed: XHR reports upload.onprogress, so the
// bar tracks bytes actually sent and the request can be canceled mid-flight.
// fetch() can't do that — it has no upload-progress event, which is why the
// previous indeterminate "Uploading…" spinner was the best it could manage.

const MAX_BYTES = 10 * 1024 * 1024; // matches the route's own limit

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

/** Extension → a short format tag. */
function formatTag(name: string): { label: string; hue: TagHue } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { label: "PDF", hue: "blue" };
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return { label: ext.toUpperCase(), hue: "teal" };
  if (["doc", "docx"].includes(ext)) return { label: "DOC", hue: "violet" };
  return { label: "File", hue: "grey" };
}

function downloadFile(id: string) {
  const a = document.createElement("a");
  a.href = `/api/files/download?id=${encodeURIComponent(id)}`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function FilesTab({
  clientId,
  files,
  uploaderNames,
  readOnly = false,
  bare = false,
}: {
  clientId: string;
  files: FileRecord[];
  /** uploaderId → display name. Absent ids fall back to an honest label. */
  uploaderNames?: Record<string, string>;
  /** Patient-portal variant: the dropzone goes, the list stays. */
  readOnly?: boolean;
  /** Board variant: the host card owns the width, so drop the page measure. */
  bare?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function upload(file: File) {
    setError(null);
    // Reject oversize before spending the round trip — the route enforces the
    // same 10 MB, so this is the same rule stated earlier, not a second rule.
    if (file.size > MAX_BYTES) {
      setError(`${file.name} is ${formatBytes(file.size)} — the limit is 10 MB.`);
      return;
    }
    setProgress({ name: file.name, pct: 0 });

    const form = new FormData();
    form.append("file", file);
    form.append("clientId", clientId);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/files");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress({ name: file.name, pct: Math.round((e.loaded / e.total) * 100) });
    };
    xhr.onload = () => {
      xhrRef.current = null;
      setProgress(null);
      let body: { file?: FileRecord; error?: string } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON body — fall through to the status-code message
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.file) {
        toast(
          <>
            <b>{file.name}</b> uploaded
          </>,
          "success",
        );
        router.refresh();
        return;
      }
      setError(body?.error ?? `Upload failed (${xhr.status}).`);
    };
    xhr.onerror = () => {
      xhrRef.current = null;
      setProgress(null);
      setError("Upload failed — the connection dropped before the file finished.");
    };
    xhr.onabort = () => {
      xhrRef.current = null;
      setProgress(null);
    };
    xhr.send(form);
  }

  const q = search.trim().toLowerCase();
  const rows = files.filter((f) => !q || f.name.toLowerCase().includes(q));
  const selectedIds = rows.filter((f) => selected.has(f.id)).map((f) => f.id);
  const latest = files.reduce<string | null>((max, f) => (max == null || f.createdAt > max ? f.createdAt : max), null);

  const columns: DataTableColumn<FileRecord>[] = [
    {
      key: "name",
      label: "Name",
      fixed: true,
      cellClassName: "max-w-[24rem] truncate",
      render: (f) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-text" title={f.name}>
            {f.name}
          </span>
          {/* A seeded row is a real file with real bytes — but it wasn't put
              here by this practice, and the record has to say so. */}
          {f.provenance === "demo_seed" && <Badge variant="neutral">Demo data</Badge>}
        </span>
      ),
      sortValue: (f) => f.name.toLowerCase(),
    },
    {
      key: "kind",
      label: "Type",
      render: (f) => {
        const k = KIND_LABELS[f.kind];
        return <Badge variant={k.variant}>{k.label}</Badge>;
      },
      sortValue: (f) => KIND_LABELS[f.kind].label,
    },
    {
      key: "format",
      label: "Format",
      defaultHidden: true,
      render: (f) => {
        const t = formatTag(f.name);
        return <Tag hue={t.hue}>{t.label}</Tag>;
      },
      sortValue: (f) => formatTag(f.name).label,
    },
    {
      key: "size",
      label: "Size",
      align: "right",
      render: (f) => <span className="text-text-muted">{formatBytes(f.sizeBytes)}</span>,
      sortValue: (f) => f.sizeBytes,
    },
    {
      key: "uploadedBy",
      label: "Uploaded by",
      render: (f) => <span className="text-text-muted">{uploaderNames?.[f.uploaderId] ?? "Practice"}</span>,
      sortValue: (f) => (uploaderNames?.[f.uploaderId] ?? "Practice").toLowerCase(),
    },
    {
      key: "added",
      label: "Added",
      render: (f) => <span className="text-text-muted">{formatDate(f.createdAt)}</span>,
      sortValue: (f) => f.createdAt,
    },
    {
      key: "storage",
      label: "Stored",
      defaultHidden: true,
      // `local` bytes live under ./uploads and do not survive a deploy, so a
      // row that says "local" is a row whose download can 404. Worth being able
      // to see, not worth a column by default.
      render: (f) => (
        <span className="text-text-muted">{f.storage === "blob" ? "Private blob" : "Local disk (dev)"}</span>
      ),
      sortValue: (f) => f.storage,
    },
  ];

  return (
    <div className={bare ? "min-w-0" : "min-w-0 max-w-4xl"}>
      {!readOnly && (
        <div className="mb-6">
          {progress ? (
            <div className="rounded-field border-2 border-dashed border-primary-weak bg-teal-100/50 px-6 py-6">
              <div className="mb-2 flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">{progress.name}</span>
                <span className="shrink-0 text-[13px] tabular-nums text-text-muted">{progress.pct}%</span>
                <Button size="sm" variant="ghost" onClick={() => xhrRef.current?.abort()}>
                  Cancel
                </Button>
              </div>
              <ProgressBar value={progress.pct} />
            </div>
          ) : (
            <FileUpload onFile={upload} constraints="Any document or image · max 10 MB" />
          )}
          {error && (
            <Banner
              variant="danger"
              className="mt-3"
              action={
                <Button size="sm" variant="ghost" onClick={() => setError(null)}>
                  Dismiss
                </Button>
              }
            >
              {error}
            </Banner>
          )}
        </div>
      )}

      {files.length === 0 ? (
        <EmptyState
          icon="file-up"
          title="No documents yet"
          subtext={
            readOnly
              ? "Documents your practice shares with you appear here."
              : "Uploads, generated form PDFs and superbills appear here."
          }
        />
      ) : (
        <DataTable
          stacked
          storageKey="client-documents-columns"
          // In a board card the card chrome already prints "Documents" and the
          // count, so the table drops its own title block rather than stack a
          // second header on the first. Standalone (the portal tab), the table
          // names itself and states its own count, per TABLE STANDARD v2.
          title={bare ? undefined : "Documents"}
          status={bare ? undefined : { variant: "success", label: `${files.length} on file` }}
          columns={columns}
          rows={rows}
          rowKey={(f) => f.id}
          defaultSort={{ col: "added", dir: "desc" }}
          onRowClick={(f) => downloadFile(f.id)}
          selected={selected}
          onSelectedChange={setSelected}
          toolbarExtra={
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents…"
              className="w-56"
            />
          }
          toolbarLeft={
            selectedIds.length > 0 ? (
              <Button size="sm" variant="secondary" leftIcon="download" onClick={() => selectedIds.forEach(downloadFile)}>
                Download {selectedIds.length}
              </Button>
            ) : undefined
          }
          rowActions={(f) => (
            <KebabMenu>
              <MenuItem icon="download" label="Download" onClick={() => downloadFile(f.id)} />
            </KebabMenu>
          )}
          source="files table · bytes in private blob storage"
          updatedAt={latest ? `Latest ${formatDate(latest)}` : undefined}
        />
      )}
    </div>
  );
}
