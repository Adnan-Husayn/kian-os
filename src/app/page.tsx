import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Root bounces to Today; the proxy sends unauthenticated users to /login. */
export default function RootPage() {
  redirect("/today");
}
