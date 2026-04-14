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
import type { GhostStatus } from "@/app/api/ghost/status/route";

const NAV = [
  { href: "/dashboard/casual",  icon: "🎣", label: "Casual Browse"  },
  { href: "/dashboard/serious", icon: "🎯", label: "Serious Mode"   },
  { href: "/dashboard/profile", icon: "👤", label: "My Profile"     },
] as const;

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs  = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 60)  return `${mins}m ago`;
  if (hrs  < 24)  return `${hrs}h ago`;
  return `${days}d ago`;
}

function GhostHeartbeat() {
  const [status, setStatus] = useState<GhostStatus | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res  = await fetch("/api/ghost/status");
        const data = await res.json() as GhostStatus;
        setStatus(data);
      } catch {
        // fail silently
      }
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const isRecent =
    status?.last_ran_at
      ? Date.now() - new Date(status.last_ran_at).getTime() < 3_600_000 // < 1 hour ago
      : false;

  const tooltipText =
    status?.status === "never"
      ? "Ghost hasn't swept yet"
      : `Last Hunt: ${formatRelativeTime(status?.last_ran_at ?? null)} · ${status?.jobs_saved ?? 0} new matches`;

  return (
    <Tooltip>
      <TooltipTrigger>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200"
          style={{
            background: "transparent",
            border: "1px solid transparent",
            cursor: "default",
          }}
          aria-label="Ghost sweep status"
        >
          {/* Pulsing ring when sweep was recent */}
          {isRecent && (
            <span
              className="absolute inset-0 rounded-lg animate-ping"
              style={{
                background: "rgba(0,255,194,0.15)",
                border: "1px solid rgba(0,255,194,0.4)",
              }}
            />
          )}
          <span
            className="relative z-10 text-[18px] leading-none"
            style={{ opacity: status?.status === "never" ? 0.35 : 1 }}
          >
            👻
          </span>
          {/* Small dot indicator */}
          {(status?.jobs_saved ?? 0) > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
              style={{ background: "#00FFC2", boxShadow: "0 0 4px rgba(0,255,194,0.8)" }}
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={12}
        className="max-w-[180px] rounded-md px-2.5 py-2 text-xs shadow-md z-50"
        style={{
          background:  "var(--popover)",
          border:      "1px solid var(--border-default)",
          color:       "var(--popover-foreground)",
          lineHeight:  "1.5",
        }}
      >
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}

function Wordmark() {
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-lg"
      style={{
        background: "var(--mint-dim)",
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

function NavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Link
          href={href}
          className="group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200"
          style={{
            background: active ? "var(--sidebar-accent)" : "transparent",
            border: active
              ? "1px solid rgba(0, 255, 194, 0.3)"
              : "1px solid transparent",
            boxShadow: active
              ? "var(--mint-nav-glow, 0 0 0 1.5px #00FFC2, 0 0 10px rgba(0, 255, 194, 0.25))"
              : "none",
          }}
        >
          {active && (
            <span
              className="absolute -left-[13px] top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full"
              style={{ background: "#00FFC2" }}
              aria-hidden
            />
          )}
          <span className="text-[18px] leading-none">{icon}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={12}
        className="rounded-md px-2.5 py-1.5 text-xs font-bold shadow-md z-50"
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
      className="glass-dark fixed inset-y-0 left-0 z-40 flex w-16 flex-col items-center pt-8 pb-5"
      style={{
        borderRight: "1px solid var(--border-default)",
        background: "rgba(5, 5, 5, 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Logo */}
      <div className="mb-8">
        <Wordmark />
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col items-center justify-center gap-3">
        {mounted &&
          NAV.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={pathname.startsWith(item.href)}
            />
          ))}
      </nav>

      {/* Bottom controls */}
      <div className="flex flex-col items-center gap-3">
        {/* Ghost Heartbeat */}
        {mounted && <GhostHeartbeat />}

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
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
