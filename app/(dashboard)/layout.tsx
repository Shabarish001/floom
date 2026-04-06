import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "../ConvexClientProvider";
import { PostHogIdentify } from "../providers/PostHogIdentify";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <PostHogIdentify />
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </ClerkProvider>
  );
}
