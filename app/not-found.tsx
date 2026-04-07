import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <h1 className="text-2xl font-semibold text-gray-900">Not found</h1>
      <p className="mt-2 text-sm text-gray-500">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/gallery" className={buttonVariants({ className: "mt-6" })}>
        Go to dashboard
      </Link>
    </div>
  );
}
