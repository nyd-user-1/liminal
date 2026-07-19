import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Best-effort reader for the agent fleet's shipped reports (docs/reports/*.md).
// Powers the /workspace "fleet" ledger. Filesystem, no DB, no PHI. If the reports
// directory isn't present in the deployment bundle it returns [] and the ledger
// simply doesn't render — the fleet roster stands on its own.

export interface ReportEntry {
  /** Date parsed from the filename (YYYY-MM-DD-*.md), date-only. */
  date: string;
  /** Filename without extension — shown mono; the founder reads these by slug. */
  slug: string;
  /** First markdown heading, cleaned of a leading date / "Report —" prefix. */
  title: string;
}

const FILE_RE = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;

/** Turn a report's first heading into a bare title. */
function cleanTitle(heading: string): string {
  return heading
    .replace(/^#\s+/, "")
    .replace(/^\d{4}-\d{2}-\d{2}\s*[—-]\s*/, "")
    .replace(/^Report\s*[—-]\s*/i, "")
    .trim();
}

export async function recentReports(limit = 8): Promise<ReportEntry[]> {
  try {
    const dir = join(process.cwd(), "docs", "reports");
    const files = (await readdir(dir))
      .filter((f) => FILE_RE.test(f))
      .sort()
      .reverse()
      .slice(0, limit);

    return await Promise.all(
      files.map(async (f) => {
        const m = FILE_RE.exec(f)!;
        // Fall back to a slug-derived title if the file can't be read.
        let title = m[2].replace(/-/g, " ");
        try {
          const head = (await readFile(join(dir, f), "utf8"))
            .split("\n")
            .find((l) => l.startsWith("# "));
          if (head) title = cleanTitle(head);
        } catch {
          /* keep the slug-derived title */
        }
        return { date: m[1], slug: f.replace(/\.md$/, ""), title };
      }),
    );
  } catch {
    return [];
  }
}
