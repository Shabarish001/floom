"use client";

import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useMutation, useConvexAuth } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

// Blocks rendering children until Clerk has provided an auth token to Convex
// and the user/org upsert has completed (prevents race conditions on first sign-up).
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user, isLoaded } = useUser();
  const upsert = useMutation(api.users.upsert);
  const [upsertDone, setUpsertDone] = useState(false);
  const upsertingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !isLoaded || !user || upsertingRef.current) return;
    upsertingRef.current = true;
    const email = user.primaryEmailAddress?.emailAddress ?? "";
    upsert({ email })
      .then(() => setUpsertDone(true))
      .catch((err) => {
        console.error(err);
        setUpsertDone(true);
      });
  }, [isAuthenticated, user?.id, isLoaded, upsert]);

  if (isLoading) return null;
  if (isAuthenticated && !upsertDone) return null;

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
