"use client";

/**
 * Last-resort boundary for failures in the root layout itself. It replaces
 * the whole document and gets none of the app's styles or fonts, so the look
 * is inlined here and follows the OS color scheme.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <title>Kian OS — something went wrong</title>
        <style>{`
          :root { --bg: #f3f3ee; --card: #fffefa; --ink: #1c1c1e; --muted: #67676d; --line: #e0e0d8; --mark: #c8352b; --accent: #2f4a9e; }
          @media (prefers-color-scheme: dark) {
            :root { --bg: #151618; --card: #1e1f22; --ink: #ecebe6; --muted: #9e9da4; --line: #303136; --mark: #e06a5f; --accent: #9fb3ee; }
          }
          body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 16px; background: var(--bg); color: var(--ink); font-family: Georgia, "Times New Roman", serif; }
          main { width: 100%; max-width: 26rem; background: var(--card); border: 1px solid var(--line); border-radius: 3px; }
          .head { margin: 0; padding: 16px 20px 8px; border-bottom: 2px solid var(--mark); font: 11px ui-monospace, Menlo, monospace; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
          .body { padding: 16px 20px 20px; }
          h1 { margin: 0 0 12px; font-size: 1.5rem; font-weight: 400; font-style: italic; }
          p { margin: 0 0 16px; color: var(--muted); font-size: .95rem; line-height: 1.5; }
          button { font: inherit; font-size: .95rem; padding: 8px 16px; border: 0; border-radius: 6px; background: var(--accent); color: var(--card); cursor: pointer; }
          small { display: block; margin-top: 16px; font: 11px ui-monospace, Menlo, monospace; color: var(--muted); }
        `}</style>
        <main role="alert">
          <p className="head">Something went wrong</p>
          <div className="body">
            <h1>Kian OS couldn&apos;t load.</h1>
            <p>
              Your data is safe — nothing was changed. Try again in a moment.
            </p>
            <button type="button" onClick={() => retry()}>
              Try again
            </button>
            {error.digest && <small>Reference: {error.digest}</small>}
          </div>
        </main>
      </body>
    </html>
  );
}
