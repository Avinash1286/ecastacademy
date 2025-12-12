import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/auth.config";
import AdminShell from "./AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    const session = await requireAdmin();
    
    if (!session) {
      redirect("/sign-in");
    }

    return <AdminShell>{children}</AdminShell>;
  } catch (error) {
    // Check if it's a specific "not admin" error vs a network/auth error
    const errorMessage = error instanceof Error ? error.message : "";
    
    if (errorMessage === "Admin access required") {
      // User is authenticated but not an admin - redirect to dashboard
      redirect("/dashboard");
    } else if (errorMessage === "Unauthorized") {
      // User is not authenticated - redirect to sign-in
      redirect("/sign-in");
    } else {
      // Network/API error - log but allow through (middleware already verified auth)
      console.error("[AdminLayout] Error checking admin status:", error);
      // Return the shell anyway - page-level checks will handle it
      return <AdminShell>{children}</AdminShell>;
    }
  }
}
