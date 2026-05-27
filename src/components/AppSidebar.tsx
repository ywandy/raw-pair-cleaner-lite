import { Camera, FileWarning, Home, Info, ListChecks, Settings } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { APP_VERSION } from "../../shared/constants";
import type { PageKey } from "../types/navigation";
import { getPressMotion } from "./MotionPrimitives";

interface AppSidebarProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
}

const NAV_ITEMS = [
  { key: "home", label: "首页", icon: Home },
  { key: "scanResult", label: "扫描结果", icon: ListChecks },
  { key: "settings", label: "设置", icon: Settings },
  { key: "about", label: "关于", icon: Info }
] satisfies Array<{ key: PageKey; label: string; icon: typeof FileWarning }>;

export function AppSidebar({ currentPage, onNavigate }: AppSidebarProps) {
  const reduced = useReducedMotion();

  return (
    <aside className="app-sidebar flex shrink-0 flex-col">
      <div className="mb-4 flex items-center gap-3 border-b border-[var(--color-border)] pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-[var(--shadow-subtle)]">
          <Camera className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="type-section-title truncate text-[var(--color-heading)]">RAW Pair</div>
          <div className="type-caption mt-0.5 truncate text-[var(--color-subtle)]">底片清理器</div>
        </div>
      </div>

      <nav className="space-y-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.key === currentPage;
          return (
            <motion.button
              key={item.key}
              className={[
                "nav-btn type-nav flex h-10 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 transition",
                active
                  ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] shadow-[var(--shadow-subtle)]"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-heading)]"
              ].join(" ")}
              onClick={() => onNavigate(item.key)}
              layout
              {...getPressMotion(reduced)}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{item.label}</span>
            </motion.button>
          );
        })}
      </nav>

      <div className="type-caption mt-auto px-2 pt-4 font-mono text-[var(--color-subtle)]">v{APP_VERSION}</div>
    </aside>
  );
}
