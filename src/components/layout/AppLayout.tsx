import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  useDocumentTitle();
  
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64">
        <div className="container max-w-7xl py-8">{children}</div>
      </main>
    </div>
  );
}
