"use client";

import { useConvexAuth } from "convex/react";
import { UserButton } from "@clerk/nextjs";

export function UserAvatar() {
  const { isAuthenticated } = useConvexAuth();
  if (!isAuthenticated) return null;
  return <UserButton />;
}
