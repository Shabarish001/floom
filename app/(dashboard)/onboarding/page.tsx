"use client";

// Onboarding flow:
// 1. User signs up via Clerk
// 2. UserSync (ConvexClientProvider) creates org record in Convex
// 3. needsOnboarding query returns true (onboardingComplete is unset)
// 4. OnboardingRedirect sends user here
// 5. User enters optional workspace name and clicks "Get started"
// 6. completeOnboarding mutation sets onboardingComplete = true
// 7. Redirect to /gallery
//
// URL/brand customization moved to Settings > Workspace to reduce onboarding friction.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const completeOnboarding = useMutation(api.organizations.completeOnboarding);

  // Guard: if user is already onboarded, redirect away from /onboarding
  const needsOnboarding = useQuery(
    api.organizations.needsOnboarding,
    isAuthenticated ? {} : "skip"
  );

  useEffect(() => {
    // Only redirect when we have a definitive "false" (onboarded).
    // undefined = loading, null = org not yet created — both should wait.
    if (needsOnboarding === false) {
      router.replace("/gallery");
    }
  }, [needsOnboarding, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await completeOnboarding({
        name: name.trim() || undefined,
      });
      router.push("/gallery");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <h1 className="text-lg font-semibold text-gray-900">
            Welcome to Floom
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Let&apos;s set up your workspace. You can customize branding later
            in Settings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace name (optional)</Label>
            <Input
              id="workspace-name"
              type="text"
              placeholder="e.g. Acme Corp"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              autoFocus
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Setting up..." : "Get started"}
            {!submitting && <ArrowRight size={14} className="ml-1.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
