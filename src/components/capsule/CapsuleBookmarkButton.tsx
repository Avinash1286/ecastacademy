"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Bookmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface CapsuleBookmarkButtonProps {
  capsuleId: Id<"capsules">;
  userId: Id<"users"> | undefined;
  className?: string;
}

export function CapsuleBookmarkButton({
  capsuleId,
  userId,
  className = "",
}: CapsuleBookmarkButtonProps) {
  const [isToggling, setIsToggling] = useState(false);

  // Check if capsule is bookmarked
  const isBookmarked = useQuery(
    api.bookmarks.isCapsuleBookmarked,
    userId ? { userId, capsuleId } : "skip"
  );

  const toggleBookmark = useMutation(api.bookmarks.toggleCapsuleBookmark);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!userId) {
      toast.error("Please sign in to bookmark capsules");
      return;
    }

    setIsToggling(true);
    try {
      const result = await toggleBookmark({ userId, capsuleId });
      toast.success(
        result.action === "added" ? "Capsule bookmarked" : "Bookmark removed"
      );
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      toast.error("Failed to update bookmark");
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      className={`h-8 w-8 transition-opacity ${
        isBookmarked
          ? "opacity-100 text-primary"
          : "opacity-0 group-hover:opacity-100"
      } ${className}`}
      onClick={handleClick}
      disabled={isToggling}
      title={isBookmarked ? "Remove bookmark" : "Bookmark capsule"}
    >
      {isToggling ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Bookmark
          className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`}
        />
      )}
    </Button>
  );
}
