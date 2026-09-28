import { requireUser } from "@/lib/auth/session";
import { ShortcutProvider } from "@/components/keyboard/shortcut-context";
import { KeyboardShortcuts } from "@/components/keyboard/KeyboardShortcuts";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

export const dynamic = "force-dynamic";

/**
 * Authenticated app shell: validates the session, then renders the desktop
 * sidebar, mobile bottom nav, and global keyboard shortcuts around the page.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <ShortcutProvider>
      <div className="flex min-h-dvh bg-bg text-text">
        <Sidebar username={user.username} />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-12">
            {children}
          </main>
        </div>
        <MobileNav username={user.username} />
      </div>
      <KeyboardShortcuts />
    </ShortcutProvider>
  );
}
