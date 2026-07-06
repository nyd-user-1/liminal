import { FindCareSearch } from "@/components/marketing/find-care-search";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Nav } from "@/components/marketing/nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Find care · Liminal",
  description: "Search licensed mental-health providers and programs across New York.",
};

export default async function FindCarePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-14">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-text">Find mental-health care</h1>
          <p className="mt-2 text-text-body">
            Licensed providers and programs across all five New York City boroughs.
          </p>
        </div>
        <FindCareSearch initialQ={q ?? ""} />
      </main>
      <MarketingFooter />
    </div>
  );
}
