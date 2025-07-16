"use client"

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LearnspaceNavbarProps {
  courseTitle: string;
}

export function LearnspaceNavbar({ courseTitle }: LearnspaceNavbarProps) {
  return (
    <nav className="sticky top-0 z-10 flex h-14 w-full items-center justify-between gap-4 border-b border-border bg-background px-4">
      <div className="flex items-center gap-4">
        {/* The Button's variant="ghost" will automatically use the correct theme colors */}
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard" aria-label="Back to dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>

        <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-medium text-foreground text-ellipsis">
                {courseTitle}
            </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Placeholder for any future right-aligned items */}
      </div>
    </nav>
  );
}