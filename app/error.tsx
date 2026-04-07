"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <h1 className="text-2xl font-semibold text-gray-900">
        Something went wrong
      </h1>
      {process.env.NODE_ENV === "development" && (
        <p className="mt-2 max-w-md text-center text-sm text-gray-500">
          {error.message}
        </p>
      )}
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
