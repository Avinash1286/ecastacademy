"use client"

import { SidebarTrigger } from '@/components/ui/sidebar'
import React from 'react'
import { usePathname } from 'next/navigation'
import { CourseSearch } from '@/components/dashboard/CourseSearch'
import { ThemeToggle } from '@/components/dashboard/ThemeToggle'
import { UserButton } from '@/components/auth/UserButton'
import { useDashboard } from '@/context/DashboardContext'

const Navbar = () => {
  const { searchTerm, setSearchTerm, isSearching, clearSearch } = useDashboard();
  const pathname = usePathname();
  
  // Only show search bar on Explore and My Learnings pages
  const showSearchBar = pathname === '/dashboard' || pathname === '/dashboard/my-learnings';

  return (
    <div className='sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-background p-2'>
      <SidebarTrigger className="h-8 w-8 p-0 hover:bg-sidebar-accent rounded cursor-pointer" />
      
      {showSearchBar && (
        <div className='flex-1 max-w-lg mx-auto'>
          <CourseSearch 
            searchTerm={searchTerm} 
            setSearchTerm={setSearchTerm}
            isSearching={isSearching}
            onClear={clearSearch}
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <UserButton />
      </div>
    </div>
  )
}

export default Navbar