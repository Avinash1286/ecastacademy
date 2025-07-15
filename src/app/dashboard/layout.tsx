"use client" 
import { SidebarProvider } from '@/components/ui/sidebar'
import React, { ReactNode } from 'react'
import AppSidebar from '@/components/dashboard/AppSidebar'
import Navbar from '@/components/dashboard/Navbar'
import { DashboardProvider } from '@/context/DashboardContext'

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <DashboardProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className='flex flex-col h-screen w-screen'>
          <Navbar />
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
      </SidebarProvider>
    </DashboardProvider>
  )
}

export default Layout