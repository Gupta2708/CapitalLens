/**
 * First-load placeholders.
 *
 * These appear ONLY before the first successful response. Background refreshes
 * keep the real table on screen -- swapping in skeletons every 15 seconds would
 * make the dashboard unreadable.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading portfolio">
      {/* Summary cards -- same padding and line heights as the real cards, so
          nothing reflows when the data lands. */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card px-5 py-[1.125rem]">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2.5 h-[34px] w-36" />
            <Skeleton className="mt-[0.3125rem] h-3.5 w-28" />
          </div>
        ))}
      </div>

      {/* Chart + movers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <Skeleton className="h-3 w-32" />
          <div className="mt-3.5 flex flex-col gap-5 sm:flex-row sm:items-center">
            <Skeleton className="mx-auto h-[164px] w-[164px] shrink-0 rounded-full" />
            <div className="flex-1 space-y-2.5">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </div>
          </div>
        </div>
        <div className="card p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-5 h-12 w-full" />
          <Skeleton className="mt-5 h-12 w-full" />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="border-b border-border-subtle px-5 py-3.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-1.5 h-3 w-40" />
        </div>
        <div className="space-y-[9px] p-5">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="h-[26px] w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
