"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
        background: "rgba(0, 255, 194, 0.15)", // Mint dim
        border: "1px solid rgba(0, 255, 194, 0.3)",
      }}
    >
      <span
        className="text-sm font-black tracking-tight"
        style={{ color: "#047857" }} // Emerald 700 for contrast
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
            background: active ? "rgba(15, 23, 42, 0.05)" : "transparent",
            border: active
              ? "1px solid rgba(15, 23, 42, 0.1)"
              : "1px solid transparent",
          }}
        >
          {active && (
            <span
              className="absolute -left-[13px] top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full"
              style={{ background: "#0F172A" }} // Slate 900
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
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          color: "#0F172A",
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

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <aside
      id="scout-sidebar"
      className="glass fixed inset-y-0 left-0 z-40 flex w-16 flex-col items-center py-5"
      style={{
        borderRight: "1px solid #E2E8F0",
        background: "rgba(251, 251, 251, 0.8)", // FBFBFB translucent
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

      <div
        className="mb-1 h-1.5 w-1.5 rounded-full"
        style={{ background: "#CBD5E1" }}
        title="v0.1"
      />
    </aside>
  );
}
