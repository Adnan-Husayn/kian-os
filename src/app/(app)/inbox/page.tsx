import { listCaptures } from "@/actions/inbox";
import { InboxList } from "@/components/inbox/InboxList";

export const dynamic = "force-dynamic";

/**
 * /inbox — unprocessed captures with convert / archive / delete and a
 * processed toggle. Everything here is a thought waiting for a home.
 */
export default async function InboxPage() {
  const captures = await listCaptures(true);
  const unprocessed = captures.filter((c) => !c.processed).length;

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          Inbox
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {unprocessed === 0
            ? "Nothing waiting."
            : `${unprocessed} unprocessed capture${unprocessed === 1 ? "" : "s"}`}
        </p>
      </header>
      <InboxList captures={captures} />
    </div>
  );
}
