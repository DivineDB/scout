"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Target, User, Ghost, Activity, Columns } from "lucide-react";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { GhostStatus } from "@/app/api/ghost/status/route";
import { cn } from "@/lib/utils";

const NAV = [
	{ href: "/dashboard/casual", icon: Search, label: "Casual Browse" },
	{ href: "/dashboard/serious", icon: Target, label: "Serious Mode" },
	{ href: "/dashboard/pipeline", icon: Columns, label: "Obsidian Pipeline" },
	{ href: "/dashboard/command-center", icon: Activity, label: "Command Center" },
	{ href: "/dashboard/profile", icon: User, label: "My Profile" },
] as const;

function formatRelativeTime(iso: string | null): string {
	if (!iso) return "Never";
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60_000);
	const hrs = Math.floor(diff / 3_360_000);
	const days = Math.floor(diff / 86_400_000);
	if (mins < 60) return `${mins}m ago`;
	if (hrs < 24) return `${hrs}h ago`;
	return `${days}d ago`;
}

function GhostHeartbeat() {
	const [status, setStatus] = useState<GhostStatus | null>(null);

	const hasFetched = useRef(false);
	useEffect(() => {
		if (hasFetched.current) return;
		hasFetched.current = true;

		async function fetchStatus() {
			try {
				const res = await fetch("/api/ghost/status");
				const data = (await res.json()) as GhostStatus;
				setStatus(data);
			} catch {
				// fail silently
			}
		}
		fetchStatus();
		const interval = setInterval(fetchStatus, 60_000); // refresh every 60s
		return () => clearInterval(interval);
	}, []);

	const isRecent = status?.last_ran_at
		? Date.now() - new Date(status.last_ran_at).getTime() < 3_600_000 // < 1 hour ago
		: false;

	const tooltipText =
		status?.status === "never"
			? "Ghost hasn't swept yet"
			: `Last Hunt: ${formatRelativeTime(status?.last_ran_at ?? null)} · ${status?.jobs_saved ?? 0} new matches`;

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						className="group relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08]"
						style={{ cursor: "default" }}
						aria-label="Ghost sweep status"
					>
						{/* Pulsing ring when sweep was recent */}
						{isRecent && (
							<span className="absolute inset-0 rounded-lg animate-pulse bg-white/5 border border-white/10" />
						)}
						<Ghost
							className="relative z-10 size-5 transition-all duration-200 group-hover:opacity-100"
							strokeWidth={1.5}
							style={{ opacity: status?.status === "never" ? 0.35 : 0.6 }}
						/>
						{/* Small dot indicator */}
						{(status?.jobs_saved ?? 0) > 0 && (
							<span
								className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
								style={{
									background: "var(--foreground)",
								}}
							/>
						)}
					</button>
				}
			/>
			<TooltipContent
				side="right"
				sideOffset={12}
				className="max-w-[180px] rounded-md px-2.5 py-2 text-xs shadow-md z-50 glass-dark"
				style={{
					background: "rgba(9, 9, 11, 0.95)",
					border: "1px solid var(--border-default)",
					color: "var(--foreground)",
					lineHeight: "1.5",
				}}
			>
				{tooltipText}
			</TooltipContent>
		</Tooltip>
	);
}

function Wordmark() {
	return (
		<div className="flex h-10 w-10 items-center justify-center">
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="text-white"
			>
				{/* Minimalist geometric S / Crosshair Hybrid */}
				<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" opacity="0.2" />
				<path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
				<path d="M16 8L8 16" />
				<path d="M8 8.5C8 8.5 9 7 12 7C15 7 16 8.5 16 10C16 11.5 14 12.5 12 12.5C10 12.5 8 13.5 8 15C8 16.5 9 18 12 18C15 18 16 16.5 16 16.5" />
			</svg>
		</div>
	);
}

function NavItem({
	href,
	icon: Icon,
	label,
	active,
}: {
	href: string;
	icon: any;
	label: string;
	active: boolean;
}) {
	const [hovered, setHovered] = useState(false);

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Link
						href={href}
						onMouseEnter={() => setHovered(true)}
						onMouseLeave={() => setHovered(false)}
						className={cn(
							"group relative flex h-12 w-full items-center justify-center transition-all duration-150 ease-out",
							active
								? "bg-gradient-to-r from-white/[0.06] to-transparent"
								: "hover:bg-white/[0.04]",
						)}
					>
						{active && (
							<span
								className="absolute left-0 top-0 h-full border-l-2 border-white/70"
								aria-hidden
							/>
						)}
						<Icon
							className={cn(
								"size-5 transition-all duration-150 ease-out group-hover:scale-105",
								active
									? "text-white"
									: "text-white/30 group-hover:text-white/80",
							)}
							strokeWidth={1.5}
						/>
					</Link>
				}
			/>
			<TooltipContent
				side="right"
				sideOffset={12}
				className="rounded-md px-2.5 py-1.5 text-xs font-medium shadow-md z-50 glass-dark"
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
			className="glass dark:glass-dark fixed inset-y-0 left-0 z-40 flex w-16 flex-col items-center pt-8 pb-5 border-r border-subtle"
		>
			{/* Logo */}
			<div className="mb-10">
				<Wordmark />
			</div>

			{/* Nav */}
			<nav className="flex w-full flex-1 flex-col items-center gap-2">
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
			<div className="flex flex-col items-center gap-5">
				{/* Ghost Heartbeat */}
				{mounted && <GhostHeartbeat />}

				<div className="flex flex-col items-center gap-1.5">
					<div
						className="h-1 w-1 rounded-full bg-accent-color opacity-40"
						title="v1.0"
					/>
					<span className="text-[8px] font-medium tracking-widest text-[var(--text-4)] uppercase">
						v1.0
					</span>
				</div>
			</div>
		</aside>
	);
}
