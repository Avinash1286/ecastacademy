"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Video, BookOpen, LayoutDashboard, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
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
                <AdminNavLink href="/admin/videos" icon={Video}>
                  Video Library
                </AdminNavLink>
                <AdminNavLink href="/admin/courses" icon={BookOpen}>
                  Courses
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
            <AdminNavLink href="/admin/videos" icon={Video} mobile>
              Video Library
            </AdminNavLink>
            <AdminNavLink href="/admin/courses" icon={BookOpen} mobile>
              Courses
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
