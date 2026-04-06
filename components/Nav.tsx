"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Menu, X } from "lucide-react";

export function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: "/gallery", label: "Gallery" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between h-12 px-4">
        <Link
          href="/gallery"
          className="flex items-center"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 48 48"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 6 Q4 6 4 12 L4 36 Q4 42 10 42 L28 42 L44 24 L28 6 Z"
              fill="currentColor"
              className="text-gray-900"
            />
          </svg>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-1">
          {links.map(({ href, label }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  isActive && "bg-muted text-foreground"
                )}
              >
                {label}
              </Link>
            );
          })}

          <Separator orientation="vertical" className="mx-1.5 h-5" />

          <OrganizationSwitcher
            hidePersonal={false}
            afterSelectOrganizationUrl="/gallery"
            afterSelectPersonalUrl="/gallery"
            appearance={{
              elements: {
                rootBox: "",
                organizationSwitcherTrigger:
                  "px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-50 border border-gray-200 transition-colors max-w-[180px]",
                organizationSwitcherPopoverActionButton__createOrganization:
                  "hidden",
              },
            }}
          />
          <div className="ml-1">
            <UserButton />
          </div>
        </div>

        {/* Mobile: user button + hamburger */}
        <div className="flex sm:hidden items-center gap-2">
          <UserButton />
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center justify-center size-8 rounded-md hover:bg-muted transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden border-t border-gray-200 px-4 py-3 space-y-2">
          {links.map(({ href, label }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {label}
              </Link>
            );
          })}
          <Separator className="my-2" />
          <div className="px-3">
            <OrganizationSwitcher
              hidePersonal={false}
              afterSelectOrganizationUrl="/gallery"
              afterSelectPersonalUrl="/gallery"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  organizationSwitcherTrigger:
                    "w-full px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-50 border border-gray-200 transition-colors",
                  organizationSwitcherPopoverActionButton__createOrganization:
                    "hidden",
                },
              }}
            />
          </div>
        </div>
      )}
    </nav>
  );
}
