"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV = [
  { href: "/dashboard/casual",  icon: "🎣", label: "Casual Browse"  },
  { href: "/dashboard/serious", icon: "🎯", label: "Serious Mode"   },
  { href: "/dashboard/profile", icon: "👤", label: "My Profile"     },
] as const;

function Wordmark() {
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-lg"
      style={{
        background: "var(--mint-dim)", // Mint dim
        border: "1px solid rgba(0, 255, 194, 0.3)",
      }}
    >
      <span
        className="text-sm font-black tracking-tight"
        style={{ color: "var(--mint)" }} 
      >
        Sc
      </span>
    </div>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean; }) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Link
          href={href}
          className="group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150"
          style={{
            background: active ? "var(--sidebar-accent)" : "transparent",
            border: active
              ? "1px solid var(--sidebar-border)"
              : "1px solid transparent",
          }}
        >
          {active && (
            <span
              className="absolute -left-[13px] top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full"
              style={{ background: "var(--sidebar-foreground)" }} 
              aria-hidden
            />
          )}
          <span className="text-[18px] leading-none">{icon}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={10}
        className="rounded-md px-2.5 py-1.5 text-xs font-bold shadow-sm"
        style={{
          background: "var(--popover)",
          border: "1px solid var(--border-default)",
          color: "var(--popover-foreground)",
        }}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <aside
      id="scout-sidebar"
      className="glass glass-dark fixed inset-y-0 left-0 z-40 flex w-16 flex-col items-center py-5"
      style={{
        borderRight: "1px solid var(--border-default)",
      }}
    >
      <div className="mb-6">
        <Wordmark />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-2">
        {mounted && NAV.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={pathname.startsWith(item.href)}
          />
        ))}
      </nav>

      <div className="mb-4 flex flex-col items-center gap-4">
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        )}
        <div
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--border-strong)" }}
          title="v0.1"
        />
      </div>
    </aside>
  );
}
