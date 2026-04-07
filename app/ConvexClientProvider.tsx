"use client";

import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useMutation, useConvexAuth } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

// Syncs the Clerk-authenticated user into the Convex users table on first load.
function UserSync() {
  const { isAuthenticated } = useConvexAuth();
  const { user, isLoaded } = useUser();
  const upsert = useMutation(api.users.upsert);

  useEffect(() => {
    if (!isAuthenticated || !isLoaded || !user) return;
    const email = user.primaryEmailAddress?.emailAddress ?? "";
    upsert({ email }).catch(console.error);
  }, [isAuthenticated, user?.id, isLoaded, upsert]);

  return null;
}

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <UserSync />
      {children}
    </ConvexProviderWithClerk>
  );
}
