import { Skeleton } from "@/components/ui/skeleton";

export default function GalleryLoading() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav placeholder */}
      <div className="h-14 border-b px-4 flex items-center">
        <Skeleton className="h-5 w-24" />
      </div>

      <div className="max-w-6xl mx-auto w-full px-4 py-6 flex-1">
        {/* Header: view toggle + search */}
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-8 w-[72px] rounded-lg" />
          <Skeleton className="h-8 w-64 rounded-md" />
        </div>

        {/* Grid of 6 skeleton cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-4 space-y-3">
              {/* Status badges */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
              {/* Icon + name + description */}
              <div className="flex items-start gap-2.5">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
              {/* Footer */}
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
