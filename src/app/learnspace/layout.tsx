import { ReactNode } from "react";

const LearnspaceLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="h-screen w-screen bg-black">
      {children}
    </div>
  );  
};

export default LearnspaceLayout;