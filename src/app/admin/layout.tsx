import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/auth.config";
import AdminShell from "./AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin().catch(() => null);

  if (!session) {
    redirect("/sign-in");
  }

  return <AdminShell>{children}</AdminShell>;
}
