"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { Book, Bookmark, Compass, Settings, Sparkles, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSidebar } from "@/components/ui/sidebar" 
import { Skeleton } from "@/components/ui/skeleton"
import { useSession } from "next-auth/react"

type NavItem = {
  href: string
  icon: LucideIcon
  label: string
  variant: "link" | "button"
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    icon: Compass,
    label: "Explore",
    variant: "link",
  },
  {
    href: "/dashboard/capsule",
    icon: Sparkles,
    label: "Capsule",
    variant: "link",
  },
  {
    href: "/dashboard/my-learnings",
    icon: Book,
    label: "My Learnings",
    variant: "link",
  },
  {
    href: "/dashboard/bookmarks",
    icon: Bookmark,
    label: "Bookmarks",
    variant: "link",
  },
  {
    href: "/admin/courses",
    icon: Settings,
    label: "Admin Panel",
    variant: "link",
    adminOnly: true,
  },
]

const AppSidebar = () => {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar();
  const { data: session } = useSession();
  
  // Check if user is admin
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  
  // Filter nav items based on user role
  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  if (isMobile === undefined) {
    return (
      <div className="w-[16rem] h-screen bg-sidebar p-2 border-r border-sidebar-border hidden md:flex flex-col">
        <div className="flex items-center justify-center gap-2 px-2 py-1">
            <h2 className="text-2xl font-nunito text-sidebar-accent-foreground">
              ECAST <span className="font-extrabold">Academy</span>
            </h2>
        </div>
        <div className="px-2 my-2">
            <Separator className="bg-border/30" />
        </div>
        <div className="p-4">
            <Skeleton className="h-10 w-full" />
        </div>
        <div className="px-2">
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/" className="flex items-center justify-center gap-2 px-2 py-1">
          <h2 className="text-2xl font-nunito text-sidebar-accent-foreground">
            ECAST <span className="font-extrabold">Academy</span>
          </h2>
        </Link>
      </SidebarHeader>

      <div className="px-4">
        <Separator className="bg-border/30" />
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) =>
                item.variant === "button" ? (
                  <div key={item.href} className="p-4">
                    <Button asChild onClick={handleLinkClick} className={cn("w-full justify-start gap-2 bg-muted text-secondary-foreground hover:bg-secondary", pathname === item.href && "bg-secondary text-secondary-foreground")}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      onClick={handleLinkClick}
                      className={cn(
                        "h-10 border border-transparent text-muted-foreground hover:border-border/50 hover:text-foreground hover:bg-gradient-to-r from-sidebar-accent/20 via-transparent to-transparent",
                        pathname === item.href &&
                          "border-border/80 bg-gradient-to-r from-sidebar-accent/70 to-transparent text-sidebar-accent-foreground"
                      )}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm font-medium tracking-tight">
                          {item.label}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar