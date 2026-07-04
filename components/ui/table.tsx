import type { ReactNode, TdHTMLAttributes } from "react";

// Catalog `Table` — muted 14/600 header row, white rows with hairline
// dividers + hover fill. Compose: <Table head={["Name","Status",""]}>
// <Tr><Td>…</Td></Tr></Table>. Pair with Toolbar above + Pagination below.

export function Table({
  head,
  className = "",
  children,
}: {
  head: ReactNode[];
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`overflow-x-auto rounded-card border border-border bg-surface shadow-card ${className}`}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 text-sm font-semibold text-text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({
  onClick,
  className = "",
  children,
}: {
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-border transition-colors last:border-b-0 hover:bg-canvas ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </tr>
  );
}

export function Td({ className = "", children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3.5 text-[15px] text-text-body ${className}`} {...rest}>
      {children}
    </td>
  );
}
