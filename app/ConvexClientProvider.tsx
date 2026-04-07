"use client";

import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useMutation, useConvexAuth } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

// Blocks rendering children until Clerk has provided an auth token to Convex.
// This prevents queries from firing before auth is ready (race condition).
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user, isLoaded } = useUser();
  const upsert = useMutation(api.users.upsert);

  useEffect(() => {
    if (!isAuthenticated || !isLoaded || !user) return;
    const email = user.primaryEmailAddress?.emailAddress ?? "";
    upsert({ email }).catch(console.error);
  }, [isAuthenticated, user?.id, isLoaded, upsert]);

  if (isLoading) return null;

  return <>{children}</>;
}

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <AuthGate>{children}</AuthGate>
    </ConvexProviderWithClerk>
  );
}
