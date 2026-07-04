import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  redirect(user.role === "client" ? "/portal" : "/calendar");
}
