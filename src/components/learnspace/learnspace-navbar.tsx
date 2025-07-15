"use client"

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LearnspaceNavbarProps {
  courseTitle: string;
}

export function LearnspaceNavbar({ courseTitle }: LearnspaceNavbarProps) {
  return (
    <nav className="sticky top-0 z-10 flex p-4 h-14 w-full items-center justify-between gap-4 border-b border-zinc-800 bg-[#181818] px-4">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="text-zinc-300 hover:bg-zinc-700 hover:text-white">
          <Link href="/dashboard" aria-label="Back to dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>

        <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-medium text-zinc-200">
                {courseTitle}
            </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
      </div>
    </nav>
  );
}