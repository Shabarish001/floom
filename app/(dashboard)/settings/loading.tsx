import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav placeholder */}
      <div className="h-14 border-b px-4 flex items-center">
        <Skeleton className="h-5 w-24" />
      </div>

      <div className="max-w-4xl mx-auto w-full px-4 py-6 flex-1">
        {/* Title */}
        <Skeleton className="h-6 w-20" />
        <div className="h-px bg-border my-4" />

        <div className="flex gap-6">
          {/* Sidebar */}
          <nav className="w-40 shrink-0 space-y-1">
            {["Workspace", "API Key", "Workspace Secrets"].map((label) => (
              <Skeleton key={label} className="h-9 w-full rounded-md" />
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-2/3 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
