"use client"

import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface DashboardContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  debouncedSearchTerm: string;
  isSearching: boolean;
  clearSearch: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  // Clear search when navigating to a different section
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      setSearchTerm('');
      setDebouncedSearchTerm('');
      prevPathname.current = pathname;
    }
  }, [pathname]);

  // Debounce search term (300ms delay)
  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) {
      setIsSearching(true);
    }
    
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, debouncedSearchTerm]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
  }, []);

  return (
    <DashboardContext.Provider value={{ 
      searchTerm, 
      setSearchTerm, 
      debouncedSearchTerm, 
      isSearching,
      clearSearch 
    }}>
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