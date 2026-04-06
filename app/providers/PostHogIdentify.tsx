"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import posthog from "posthog-js";

export function PostHogIdentify() {
  const { user, isLoaded } = useUser();
  const prevUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (user) {
      prevUserId.current = user.id;
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      });
    } else if (prevUserId.current) {
      prevUserId.current = null;
      posthog.reset();
    }
  }, [user, isLoaded]);

  return null;
}
