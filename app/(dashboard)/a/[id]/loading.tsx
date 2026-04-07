import { Skeleton } from "@/components/ui/skeleton";

export default function AutomationLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav placeholder */}
      <div className="h-14 border-b px-4 flex items-center">
        <Skeleton className="h-5 w-24" />
      </div>

      {/* Header */}
      <div className="px-4 py-3 border-b space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-3 w-36" />
      </div>

      {/* Tabs */}
      <div className="px-4 py-2 border-b">
        <div className="flex items-center gap-1">
          {["App", "Runs", "Versions", "Webhook", "Secrets"].map((tab) => (
            <Skeleton key={tab} className="h-8 w-20 rounded-md" />
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left panel */}
        <div className="lg:w-[40%] border-b lg:border-b-0 lg:border-r p-4 space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
        {/* Right panel */}
        <div className="lg:w-[60%] p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-32 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
