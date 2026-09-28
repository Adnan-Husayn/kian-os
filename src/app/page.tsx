import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Root bounces to Today; the (app) layout sends signed-out users to /login. */
export default function RootPage() {
  redirect("/today");
}
