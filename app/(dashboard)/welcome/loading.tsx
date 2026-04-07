import { Skeleton } from "@/components/ui/skeleton";

export default function WelcomeLoading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <Skeleton className="h-7 w-48 mx-auto" />
          <Skeleton className="h-4 w-72 mx-auto" />
        </div>

        {/* API Key card */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-3.5 rounded" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>

        {/* Quick start */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>

        {/* Continue button */}
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  );
}
