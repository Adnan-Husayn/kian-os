import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in: skip the form.
  if (await getSessionUser()) redirect("/today");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <LoginForm />
    </main>
  );
}
