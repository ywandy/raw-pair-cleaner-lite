import type { FontScale } from "../../shared/types";
import { AppSidebar } from "./AppSidebar";
import type { PageKey } from "../types/navigation";

interface AppLayoutProps {
  currentPage: PageKey;
  fontScale: FontScale;
  onNavigate: (page: PageKey) => void;
  children: React.ReactNode;
}

export function AppLayout({ currentPage, fontScale, onNavigate, children }: AppLayoutProps) {
  return (
    <div className="app-shell flex h-screen w-screen min-w-[1200px]" data-font-scale={fontScale}>
      <div className="flex h-full w-full min-w-[1200px] flex-col overflow-hidden">
        <div className="app-frame flex min-h-0 flex-1">
          <AppSidebar currentPage={currentPage} onNavigate={onNavigate} />
          <main className="app-main flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
