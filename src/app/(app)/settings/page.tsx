import { requireUser } from "@/lib/auth/session";
import { SettingsView } from "@/components/settings/SettingsView";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  return <SettingsView username={user.username} />;
}
