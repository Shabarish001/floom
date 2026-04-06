"use client";

import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useMutation, useQuery, useConvexAuth } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

// Syncs the Clerk-authenticated user into the Convex users table on first load.
function UserSync() {
  const { user, isLoaded } = useUser();
  const upsert = useMutation(api.users.upsert);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const email = user.primaryEmailAddress?.emailAddress ?? "";
    upsert({ email }).catch(console.error);
  }, [user?.id, isLoaded, upsert]);

  return null;
}

// Redirects new users to /onboarding if their workspace setup is incomplete.
//
// Race condition protection: UserSync (above) creates the org via mutation, but
// needsOnboarding is a query that may resolve before the mutation commits.
// When the org doesn't exist yet, needsOnboarding returns `null` (not true/false),
// and this effect treats null the same as `undefined` (loading) — it does nothing.
// Once UserSync's mutation commits, Convex reactivity re-fires the query, which
// then returns true or false and the redirect logic proceeds safely.
function OnboardingRedirect() {
  const { isAuthenticated } = useConvexAuth();
  const pathname = usePathname();
  const router = useRouter();

  const needsOnboarding = useQuery(
    api.organizations.needsOnboarding,
    isAuthenticated ? {} : "skip"
  );

  useEffect(() => {
    if (needsOnboarding === undefined || needsOnboarding === null) return; // loading or org not yet created by UserSync
    if (!needsOnboarding) return; // already onboarded

    // Don't redirect if already on onboarding, sign-in, or sign-up pages
    if (
      pathname === "/onboarding" ||
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/sign-up")
    ) {
      return;
    }

    router.replace("/onboarding");
  }, [needsOnboarding, pathname, router]);

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
      <OnboardingRedirect />
      {children}
    </ConvexProviderWithClerk>
  );
}
