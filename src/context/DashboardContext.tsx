"use client"

import { createContext, useContext, useState, ReactNode } from 'react';

interface DashboardContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <DashboardContext.Provider value={{ searchTerm, setSearchTerm }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = (): DashboardContextType => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};