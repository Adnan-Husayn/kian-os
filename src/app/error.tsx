"use client";

import { ErrorCard } from "@/components/layout/ErrorCard";

/**
 * Catches failures above the app shell (for example the session check in the
 * (app) layout when the database is unreachable), so it draws its own page.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="dot-page min-h-dvh">
      <ErrorCard error={error} retry={retry} />
    </main>
  );
}
