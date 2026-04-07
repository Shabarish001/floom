"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Globe, Lock, Link2, X, ChevronDown } from "lucide-react";

interface SharePopoverProps {
  automation: {
    _id: Id<"automations">;
    name: string;
    publishedAt?: number;
    publishedSlug?: string;
    publishAccess?: "public" | "email";
    allowedEmails?: string[];
  };
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SharePopover({ automation, children, open, onOpenChange }: SharePopoverProps) {
  const { user } = useUser();
  const [emailInput, setEmailInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [accessMenuOpen, setAccessMenuOpen] = useState(false);

  const addAllowedEmail = useMutation(api.automations.addAllowedEmail);
  const removeAllowedEmail = useMutation(api.automations.removeAllowedEmail);
  const updatePublishAccess = useMutation(api.automations.updatePublishAccess);
  const publishAutomation = useMutation(api.automations.publish);

  const isPublished = !!automation.publishedAt;
  const accessMode = automation.publishAccess ?? "email";
  const allowedEmails = automation.allowedEmails ?? [];

  const handleInvite = useCallback(async () => {
    const email = emailInput.trim();
    if (!email) return;
    await addAllowedEmail({
      automationId: automation._id,
      email,
    });
    setEmailInput("");
  }, [emailInput, automation._id, addAllowedEmail]);

  const handleRemoveEmail = useCallback(
    async (email: string) => {
      await removeAllowedEmail({
        automationId: automation._id,
        email,
      });
    },
    [automation._id, removeAllowedEmail]
  );

  const handleAccessChange = useCallback(
    async (value: string | null) => {
      if (!value) return;
      const access = value as "public" | "email";
      await updatePublishAccess({
        automationId: automation._id,
        access,
        allowedEmails: access === "email" ? allowedEmails : undefined,
      });
    },
    [automation._id, updatePublishAccess, allowedEmails]
  );

  const handleCopyLink = useCallback(async () => {
    let slug = automation.publishedSlug;
    if (!isPublished) {
      const result = await publishAutomation({
        automationId: automation._id,
        access: "public",
      });
      slug = result.slug;
    }
    if (slug) {
      navigator.clipboard.writeText(
        `${window.location.origin}/p/${slug}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [automation, isPublished, publishAutomation]);

  const ownerEmail = user?.primaryEmailAddress?.emailAddress;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={children as React.ReactElement} nativeButton={false} />
      <PopoverContent
        className="w-[380px]"
        showCloseButton={false}
        side="bottom"
        align="end"
        sideOffset={4}
      >
        <div className="space-y-4">
          {/* Title */}
          <h3 className="font-medium text-base pr-6">
            Share &lsquo;{automation.name}&rsquo;
          </h3>

          {/* Add email */}
          <div className="flex gap-2">
            <Input
              placeholder="Add people by email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleInvite();
                }
              }}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleInvite}
              disabled={!emailInput.trim()}
            >
              Invite
            </Button>
          </div>

          {/* People with access */}
          {(ownerEmail || allowedEmails.length > 0) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                People with access
              </p>
              <div className="space-y-1">
                {ownerEmail && (
                  <div className="flex items-center justify-between py-1.5">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{ownerEmail}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      Owner
                    </span>
                  </div>
                )}
                {allowedEmails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between py-1.5"
                  >
                    <p className="text-sm truncate min-w-0">{email}</p>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemoveEmail(email)}
                      className="shrink-0 ml-2"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* General access */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              General access
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-8 rounded-full bg-muted shrink-0">
                {accessMode === "public" ? (
                  <Globe className="size-4" />
                ) : (
                  <Lock className="size-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <DropdownMenu
                  open={accessMenuOpen}
                  onOpenChange={setAccessMenuOpen}
                >
                  <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium hover:opacity-70 transition-opacity cursor-pointer">
                    {accessMode === "public" ? "Anyone with the link" : "Restricted"}
                    <ChevronDown className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[200px]">
                    <DropdownMenuRadioGroup
                      value={accessMode}
                      onValueChange={(value) => {
                        handleAccessChange(value);
                        setAccessMenuOpen(false);
                      }}
                    >
                      <DropdownMenuRadioItem value="email">
                        <Lock className="size-4" />
                        Restricted
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="public">
                        <Globe className="size-4" />
                        Anyone with the link
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-xs text-muted-foreground">
                  {accessMode === "public"
                    ? "Anyone with the link can use this app"
                    : "Only people with access can use this app"}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Footer */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
            >
              <Link2 className="size-3.5" />
              {copied ? "Copied!" : "Copy link"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
