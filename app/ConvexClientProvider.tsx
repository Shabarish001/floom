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
function OnboardingRedirect() {
  const { isAuthenticated } = useConvexAuth();
  const pathname = usePathname();
  const router = useRouter();

  const needsOnboarding = useQuery(
    api.organizations.needsOnboarding,
    isAuthenticated ? {} : "skip"
  );

  useEffect(() => {
    if (needsOnboarding === undefined || needsOnboarding === null) return; // loading or org not yet created
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
