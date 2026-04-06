"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function Nav() {
  const pathname = usePathname();

  const links = [
    { href: "/gallery", label: "Gallery" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="flex items-center justify-between h-12 px-4 border-b border-gray-200 bg-white">
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

      <div className="flex items-center gap-1">
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
                "px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-50 border border-gray-200 transition-colors",
              organizationSwitcherPopoverActionButton__createOrganization:
                "hidden",
            },
          }}
        />
        <div className="ml-1">
          <UserButton />
        </div>
      </div>
    </nav>
  );
}
