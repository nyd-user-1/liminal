import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/spinner";
import { Table, Td, Tr } from "@/components/ui/table";

// Loading placeholder for the rate tables — real Table chrome, pulsing cells,
// so the surface doesn't jump when data lands.

export function TableSkeleton({ head, rows = 6 }: { head: ReactNode[]; rows?: number }) {
  return (
    <Table head={head}>
      {Array.from({ length: rows }, (_, i) => (
        <Tr key={i}>
          {head.map((_, j) => (
            <Td key={j}>
              <Skeleton className={`h-4 ${j === 0 ? "w-40" : "w-20"}`} />
            </Td>
          ))}
        </Tr>
      ))}
    </Table>
  );
}
