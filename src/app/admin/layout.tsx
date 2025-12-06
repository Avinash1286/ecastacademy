"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { Video, BookOpen, LayoutDashboard, LucideIcon, Users, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const userRole = session?.user?.role;

  useEffect(() => {
    if (status === "authenticated" && userRole !== "admin") {
      router.push("/dashboard");
    } else if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, userRole, router]);

  // Show loading while checking auth
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render admin content if not admin
  if (userRole !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Admin Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/admin" className="flex items-center gap-2 font-semibold text-muted-foreground">
                <LayoutDashboard className="w-5 h-5" />
                Admin Panel
              </Link>

              <nav className="hidden md:flex gap-6">
                <AdminNavLink href="/admin/courses" icon={BookOpen}>
                  Courses
                </AdminNavLink>
                <AdminNavLink href="/admin/videos" icon={Video}>
                  Video Library
                </AdminNavLink>
                <AdminNavLink href="/admin/users" icon={Users}>
                  Users
                </AdminNavLink>
                <AdminNavLink href="/admin/ai" icon={Bot}>
                  AI Models
                </AdminNavLink>
              </nav>
            </div>

            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>

          {/* Mobile Navigation */}
          <nav className="md:hidden flex gap-4 pb-3 overflow-x-auto">
            <AdminNavLink href="/admin/courses" icon={BookOpen} mobile>
              Courses
            </AdminNavLink>
            <AdminNavLink href="/admin/videos" icon={Video} mobile>
              Video Library
            </AdminNavLink>
            <AdminNavLink href="/admin/users" icon={Users} mobile>
              Users
            </AdminNavLink>
            <AdminNavLink href="/admin/ai" icon={Bot} mobile>
              AI Models
            </AdminNavLink>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-background">
        {children}
      </main>
    </div>
  );
}

function AdminNavLink({
  href,
  icon: Icon,
  children,
  mobile = false
}: {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname?.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 transition-colors",
        mobile
          ? "text-sm px-3 py-1.5 rounded-md whitespace-nowrap"
          : "text-sm",
        isActive
          ? "text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground",
        mobile && isActive && "bg-accent"
      )}
    >
      <Icon className="w-4 h-4" />
      {children}
    </Link>
  );
}
