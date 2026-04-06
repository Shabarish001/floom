"use client";

// Onboarding flow:
// 1. User signs up via Clerk
// 2. UserSync (ConvexClientProvider) creates org record in Convex
// 3. needsOnboarding query returns true (onboardingComplete is unset)
// 4. OnboardingRedirect sends user here
// 5. User enters website URL (or skips)
// 6. completeOnboarding mutation sets onboardingComplete = true
// 7. Redirect to /gallery (or /welcome once #12 is merged)

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, ArrowRight } from "lucide-react";

export default function OnboardingPage() {
  const [url, setUrl] = useState("");
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

  function normalizeUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }

  function isValidUrl(input: string): boolean {
    try {
      const parsed = new URL(input);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalized = normalizeUrl(url);
    if (normalized && !isValidUrl(normalized)) {
      setError("Please enter a valid URL (e.g. example.com)");
      return;
    }

    setSubmitting(true);
    try {
      await completeOnboarding({
        websiteUrl: normalized || undefined,
      });
      router.push("/gallery");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    setSubmitting(true);
    try {
      await completeOnboarding({});
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
            Set up your workspace
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your company website so Floom can pull in your brand assets
            automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="website-url">Company website</Label>
            <div className="relative">
              <Globe
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="website-url"
                type="text"
                placeholder="example.com"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                className="pl-8"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={submitting || !url.trim()}
          >
            {submitting ? "Setting up..." : "Continue"}
            {!submitting && <ArrowRight size={14} className="ml-1.5" />}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleSkip}
            disabled={submitting}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
          <p className="text-xs text-muted-foreground/60 mt-1">
            For solo devs or hobbyists
          </p>
        </div>
      </div>
    </div>
  );
}
