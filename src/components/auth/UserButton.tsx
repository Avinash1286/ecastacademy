"use client";

import { UserButton as ClerkUserButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export function UserButton() {
  return (
    <ClerkUserButton
      afterSignOutUrl="/"
      appearance={{
        baseTheme: dark,
        elements: {
          avatarBox: "h-10 w-10 ring-2 ring-border hover:ring-primary/50 transition-all",
          userButtonPopoverCard: "shadow-xl border border-border !bg-popover",
          userButtonPopoverActionButton: "hover:bg-accent !text-foreground",
          userButtonPopoverActionButtonText: "!text-foreground",
          userButtonPopoverActionButtonIcon: "!text-muted-foreground",
          userButtonPopoverFooter: "hidden",
          userPreviewMainIdentifier: "!text-foreground",
          userPreviewSecondaryIdentifier: "!text-muted-foreground",
        },
        variables: {
          colorPrimary: "#22c55e",
          colorBackground: "#2a2a2a",
          colorText: "#fafafa",
          colorTextSecondary: "#a1a1aa",
          colorDanger: "#f87171",
          borderRadius: "0.625rem",
        },
      }}
    />
  );
}


