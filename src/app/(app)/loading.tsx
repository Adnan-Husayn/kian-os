import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown inside the app shell while a page's data loads: a heading and two
 * blank index cards with ruled lines, roughly the shape of every page.
 */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-3 w-40" />
      </div>
      {[3, 5].map((rows) => (
        <div key={rows} className="index-card">
          <div className="index-card-head px-5 pb-2 pt-4">
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="px-4 pb-3">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="log-row flex items-center gap-3 px-1 py-3.5">
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-4" style={{ width: `${68 - i * 9}%` }} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
