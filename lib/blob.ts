import { get, put, type PutBlobResult } from "@vercel/blob";

// Two Vercel Blob stores back this app:
//   • PRIVATE — client files (PHI). Uses the SDK-default BLOB_READ_WRITE_TOKEN;
//     reads only ever flow through the authenticated /api/files/download proxy.
//   • PUBLIC  — shareable assets (images, PDFs). Uses PUBLIC_BLOB_READ_WRITE_TOKEN;
//     the returned URL is a plain CDN link usable directly in <img src>.
// Both stores' tokens live in the env, and BLOB_STORE_ID is set, so the SDK's
// implicit auth resolution is ambiguous — private reads even take an OIDC path
// that 403s. Passing the store's token EXPLICITLY on every call is the fix and
// keeps callers from crossing the stores.

type BlobAccess = "public" | "private";

interface BlobPutOptions {
  access: BlobAccess;
  contentType?: string;
  addRandomSuffix?: boolean;
}

export function blobPut(
  pathname: string,
  body: Parameters<typeof put>[1],
  opts: BlobPutOptions,
): Promise<PutBlobResult> {
  const token =
    opts.access === "public"
      ? process.env.PUBLIC_BLOB_READ_WRITE_TOKEN
      : process.env.BLOB_READ_WRITE_TOKEN;
  return put(pathname, body, {
    access: opts.access,
    contentType: opts.contentType,
    addRandomSuffix: opts.addRandomSuffix,
    token,
  });
}

/**
 * Read a PRIVATE blob by pathname (or URL). Passes the private store's token
 * explicitly — the default resolution 403s when two stores share the env.
 * Returns null if the blob is missing.
 */
export function blobGetPrivate(pathnameOrUrl: string) {
  return get(pathnameOrUrl, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
}
