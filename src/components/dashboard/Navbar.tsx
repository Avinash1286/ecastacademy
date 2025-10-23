"use client"

import { SidebarTrigger } from '@/components/ui/sidebar'
import React from 'react'
import { CourseSearch } from '@/components/dashboard/CourseSearch'
import { ThemeToggle } from '@/components/dashboard/ThemeToggle'
import { useDashboard } from '@/context/DashboardContext'
import { Button } from '@/components/ui/button'
import { useAuthActions } from '@convex-dev/auth/react'
import { useCurrentUser } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2 } from 'lucide-react'

const Navbar = () => {
  const { searchTerm, setSearchTerm } = useDashboard();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { user } = useCurrentUser();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const initials = React.useMemo(() => {
    if (!user?.name && !user?.email) return 'U'
    const source = user?.name ?? user?.email ?? 'U'
    return source
      .split(' ')
      .filter(Boolean)
      .map((segment: string) => segment[0]?.toUpperCase())
      .slice(0, 2)
      .join('') || 'U'
  }, [user?.name, user?.email])

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      await signOut()
      toast.success('Signed out')
      router.replace('/login')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign out'
      toast.error(message)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className='sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-background p-2'>
      <SidebarTrigger className="h-8 w-8 p-0 hover:bg-sidebar-accent rounded cursor-pointer" />
      
      <div className='flex-1 max-w-lg mx-auto'>
        <CourseSearch searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-1.5">
          <Avatar className="h-8 w-8">
            {user?.image ? <AvatarImage src={user.image} alt={user.name ?? 'User'} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left text-sm leading-tight sm:block">
            <p className="font-medium">{user?.name ?? user?.email ?? 'Learner'}</p>
            <p className="text-xs text-muted-foreground">{user?.role ?? 'user'}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleSignOut} disabled={isSigningOut}>
          {isSigningOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign out
        </Button>
      </div>
    </div>
  )
}

export default Navbar