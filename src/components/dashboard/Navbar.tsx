"use client"

import { SidebarTrigger } from '@/components/ui/sidebar'
import React from 'react'
import { CourseSearch } from '@/components/dashboard/CourseSearch'
import { ThemeToggle } from '@/components/dashboard/ThemeToggle'
import { UserButton } from '@/components/auth/UserButton'
import { useDashboard } from '@/context/DashboardContext'

const Navbar = () => {
  const { searchTerm, setSearchTerm } = useDashboard();

  return (
    <div className='sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-background p-2'>
      <SidebarTrigger className="h-8 w-8 p-0 hover:bg-sidebar-accent rounded cursor-pointer" />
      
      <div className='flex-1 max-w-lg mx-auto'>
        <CourseSearch searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <UserButton />
      </div>
    </div>
  )
}

export default Navbar