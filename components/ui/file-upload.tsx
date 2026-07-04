"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";

// Catalog `FileUpload` — dropzone: dashed primary border, pale-primary fill,
// upload icon + "Click to upload" + constraints caption. Uploaded state =
// pale tile with check-circle + filename + remove.

export function FileUpload({
  onFile,
  accept,
  constraints,
  file,
  onRemove,
  className = "",
}: {
  onFile: (file: File) => void;
  accept?: string;
  constraints?: string; // e.g. "PDF, PNG or JPG · max 10 MB"
  file?: { name: string } | null; // set → uploaded state
  onRemove?: () => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  if (file) {
    return (
      <div className={`flex items-center gap-3 rounded-field bg-teal-100 px-4 py-3 ${className}`}>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-success-tint text-success">
          <Icon name="check" size={16} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">{file.name}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label="Remove file" className="text-text-muted hover:text-danger">
            <Icon name="x" size={18} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-field border-2 border-dashed px-6 py-8 text-center transition-colors ${
        dragging ? "border-primary bg-teal-100" : "border-primary-weak bg-teal-100/50"
      } ${className}`}
    >
      <Icon name="upload" size={24} className="text-primary" />
      <p className="text-[15px] text-text-body">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="font-semibold text-primary hover:text-primary-hover"
        >
          Click to upload
        </button>{" "}
        or drag and drop
      </p>
      {constraints && <p className="text-[13px] text-text-muted">{constraints}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
