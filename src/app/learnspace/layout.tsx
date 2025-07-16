import { ReactNode } from "react";

const LearnspaceLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="h-screen w-screen bg-background">
      {children}
    </div>
  );  
};

export default LearnspaceLayout;