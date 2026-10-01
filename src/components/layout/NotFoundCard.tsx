import Link from "next/link";

/** Shared 404: a blank index card pointing back to Today. */
export function NotFoundCard() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="index-card w-full max-w-md">
        <p className="index-card-head journal-label px-5 pb-2 pt-4">
          Page not found
        </p>
        <div className="space-y-4 px-5 pb-5 pt-4">
          <h1 className="text-2xl italic leading-snug">
            Nothing is written on this page.
          </h1>
          <p className="text-sm text-text-secondary">
            The link may be old, or the item may have been deleted.
          </p>
          <Link
            href="/today"
            className="inline-block text-sm text-accent underline underline-offset-4"
          >
            Back to Today
          </Link>
        </div>
      </div>
    </div>
  );
}
