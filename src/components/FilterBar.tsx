"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, Sliders } from "lucide-react";
import meData from "@/data/me.json";

// ---- Types ------------------------------------------------------------------
interface FilterState {
	roles: string[];
	location: string[];
	salaryMin: number;
	skills: string[];
}

const ROLES = [
	"Design Engineer",
	"Full-stack",
	"Frontend",
	"AI Engineer",
] as const;

const LOCATIONS = ["Remote", "Hybrid", "On-site"] as const;
const SALARY_MIN = 8;
const SALARY_MAX = 40;
const SALARY_DEFAULT = 12;

// Flatten all skills from me.json into a single list
const ALL_SKILLS: string[] = Object.values(meData.skills).flat();

// ---- API call (now throws on failure so caller can rollback) ----------------
async function patchProfile(filters: FilterState): Promise<void> {
	const res = await fetch("/api/profile/update", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			preferred_roles: filters.roles,
			preferred_location: filters.location,
			salary_min: filters.salaryMin,
			salary_ideal: Math.round(filters.salaryMin * 2),
		}),
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: "Network error" }));
		throw new Error(err.error ?? "Failed to sync preferences");
	}
}

// ---- Sub-components ---------------------------------------------------------

function RoleBadge({
	label,
	active,
	onClick,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			suppressHydrationWarning
			className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${
				active
					? "bg-mint-dim text-mint border-focus shadow-[0_0_15px_rgba(16,185,129,0.15)]"
					: "bg-white/5 text-white/40 border-white/5 hover:bg-white/[0.09] hover:border-white/15 hover:text-white/70"
			}`}
		>
			{label}
		</button>
	);
}

function LocationButton({
	label,
	active,
	onClick,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			suppressHydrationWarning
			className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 first:rounded-l-md last:rounded-r-md border-r last:border-r-0 ${
				active
					? "bg-mint-dim text-mint border-focus"
					: "bg-white/5 text-white/30 border-white/5 hover:bg-white/[0.09] hover:text-white/60"
			}`}
		>
			{label}
		</button>
	);
}

// ---- Main Component ---------------------------------------------------------
export function FilterBar() {
	const [filters, setFilters] = useState<FilterState>({
		roles: ["Design Engineer", "Full-stack", "Frontend"],
		location: ["Remote"],
		salaryMin: SALARY_DEFAULT,
		skills: ALL_SKILLS.slice(0, 6),
	});

	// ---- Optimistic UI refs -------------------------------------------------
	// Last state successfully written to the DB. Used for rollback on failure.
	const committedRef = useRef<FilterState>(filters);
	// Timer handle for the debounced API write.
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Suppress the first sync fired during the initial mount data-load.
	const isFirstSyncRef = useRef(true);

	// Load saved profile on mount and set the committed baseline.
	useEffect(() => {
		fetch("/api/profile/update")
			.then((r) => r.json())
			.then(({ profile }) => {
				if (!profile) return;
				const loaded: FilterState = {
					roles:
						profile.preferred_roles?.length > 0
							? profile.preferred_roles
							: filters.roles,
					location:
						profile.preferred_location?.length > 0
							? profile.preferred_location
							: filters.location,
					salaryMin: profile.salary_min ?? filters.salaryMin,
					skills: filters.skills,
				};
				setFilters(loaded);
				committedRef.current = loaded; // this is now the rollback baseline
			})
			.catch(() => {});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ---- Core optimistic dispatch -------------------------------------------
	// Every interaction calls this. UI updates IMMEDIATELY; the API write is
	// scheduled 600ms later. If multiple interactions happen within 600ms,
	// only the final state is sent to the server.
	const dispatchUpdate = useCallback((next: FilterState) => {
		// 1. Instant UI update.
		setFilters(next);

		// 2. Cancel any in-flight debounce timer.
		if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

		// 3. Suppress sync during the initial data load.
		if (isFirstSyncRef.current) {
			isFirstSyncRef.current = false;
			committedRef.current = next;
			return;
		}

		// 4. Schedule debounced API write at 600ms.
		debounceTimerRef.current = setTimeout(async () => {
			const rollbackState = committedRef.current;

			try {
				await patchProfile(next);
				// Success: advance the committed baseline.
				committedRef.current = next;
				const { toast } = await import("sonner");
				toast.success("Preferences synced", {
					duration: 1800,
					// Deduplicate: rapid saves collapse into a single toast.
					id: "filter-sync",
				});
			} catch (err: unknown) {
				// Failure: revert the UI to the last good state.
				setFilters(rollbackState);
				const { toast } = await import("sonner");
				toast.error("Failed to sync preferences", {
					description:
						err instanceof Error ? err.message : "Please try again.",
				});
			}
		}, 600);
	}, []);

	// ---- Toggle helpers -----------------------------------------------------
	const toggleRole = useCallback(
		(role: string) => {
			dispatchUpdate({
				...filters,
				roles: filters.roles.includes(role)
					? filters.roles.filter((r) => r !== role)
					: [...filters.roles, role],
			});
		},
		[filters, dispatchUpdate],
	);

	const toggleLocation = useCallback(
		(loc: string) => {
			dispatchUpdate({
				...filters,
				location: filters.location.includes(loc)
					? filters.location.filter((l) => l !== loc)
					: [...filters.location, loc],
			});
		},
		[filters, dispatchUpdate],
	);

	const toggleSkill = useCallback(
		(skill: string) => {
			dispatchUpdate({
				...filters,
				skills: filters.skills.includes(skill)
					? filters.skills.filter((s) => s !== skill)
					: [...filters.skills, skill],
			});
		},
		[filters, dispatchUpdate],
	);

	const handleSalaryChange = useCallback(
		(value: number) => {
			dispatchUpdate({ ...filters, salaryMin: value });
		},
		[filters, dispatchUpdate],
	);

	return (
		<div
			className="sticky top-0 z-50 w-full backdrop-blur-md"
			style={{
				background: "color-mix(in srgb, var(--surface-1) 85%, transparent)",
				borderBottom: "1px solid var(--border-subtle)",
			}}
		>
			<div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-6 py-3 md:px-10">

				{/* ---- Role Pills ----------------------------------------- */}
				<div className="flex flex-wrap items-center gap-1.5">
					{ROLES.map((role) => (
						<RoleBadge
							key={role}
							label={role}
							active={filters.roles.includes(role)}
							onClick={() => toggleRole(role)}
						/>
					))}
				</div>

				<div
					className="hidden h-4 w-px md:block"
					style={{ background: "rgba(255,255,255,0.08)" }}
				/>

				{/* ---- Location Segmented Control -------------------------- */}
				<div className="flex rounded-md">
					{LOCATIONS.map((loc) => (
						<LocationButton
							key={loc}
							label={loc}
							active={filters.location.includes(loc)}
							onClick={() => toggleLocation(loc)}
						/>
					))}
					{/* invisible sentinel keeps the last button's right border */}
					<button
						onClick={() => toggleLocation(LOCATIONS[LOCATIONS.length - 1])}
						className="hidden"
						style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }}
					/>
				</div>

				<div
					className="hidden h-4 w-px md:block"
					style={{ background: "rgba(255,255,255,0.08)" }}
				/>

				{/* ---- Salary Slider --------------------------------------- */}
				<div className="flex items-center gap-2.5">
					<span className="text-xs font-semibold" style={{ color: "#52525B" }}>
						&#8377;
					</span>
					<input
						type="range"
						min={SALARY_MIN}
						max={SALARY_MAX}
						step={1}
						value={filters.salaryMin}
						onChange={(e) => handleSalaryChange(parseInt(e.target.value))}
						className="salary-slider h-1 w-28 cursor-pointer appearance-none rounded-full outline-none"
						style={{
							background: `linear-gradient(to right, white 0%, white ${
								((filters.salaryMin - SALARY_MIN) / (SALARY_MAX - SALARY_MIN)) * 100
							}%, rgba(255,255,255,0.05) ${
								((filters.salaryMin - SALARY_MIN) / (SALARY_MAX - SALARY_MIN)) * 100
							}%, rgba(255,255,255,0.05) 100%)`,
						}}
					/>
					<span
						className="min-w-[40px] text-[10px] font-black tracking-tighter"
						style={{ color: "white" }}
					>
						L{filters.salaryMin}+
					</span>
				</div>

				<div
					className="hidden h-4 w-px md:block"
					style={{ background: "rgba(255,255,255,0.08)" }}
				/>

				<Popover>
					<PopoverTrigger suppressHydrationWarning className="flex items-center gap-1.5 rounded-md border border-white/5 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/40 transition-all hover:text-white/60 hover:border-white/10">
						<Sliders className="h-3 w-3" />
						Stack
						<ChevronDown className="h-3 w-3" />
					</PopoverTrigger>
					<PopoverContent
						side="bottom"
						align="end"
						sideOffset={8}
						className="z-[9999] w-80 p-4"
						style={{
							background: "#0E0E0E",
							border: "1px solid rgba(255,255,255,0.1)",
							borderRadius: "12px",
							boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
						}}
					>
						<p
							className="mb-3 text-[10px] font-bold uppercase tracking-widest"
							style={{ color: "#52525B" }}
						>
							Tech Arsenal
						</p>
						<div className="flex flex-wrap gap-1.5">
							{ALL_SKILLS.map((skill) => {
								const active = filters.skills.includes(skill);
								return (
									<button
										key={skill}
										onClick={() => toggleSkill(skill)}
										suppressHydrationWarning
										className={`rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight transition-all duration-200 ${
											active
												? "bg-mint-dim text-mint border-focus"
												: "bg-white/5 text-white/30 border-white/5 hover:bg-white/[0.09] hover:text-white/60 hover:border-white/10"
										}`}
									>
										{skill}
									</button>
								);
							})}
						</div>
					</PopoverContent>
				</Popover>

				{/* ---- Trailing label ------------------------------------- */}
				<div className="ml-auto flex items-center gap-1.5">
					<span
						className="text-[10px] font-medium"
						style={{ color: "#3F3F46" }}
					>
						syncs to next sweep
					</span>
				</div>
			</div>

			{/* Slider thumb styles */}
			<style>{`
        .salary-slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 2px;
          background: white;
          cursor: pointer;
          border: 1px solid black;
        }
        .salary-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 2px;
          background: white;
          cursor: pointer;
          border: 1px solid black;
        }
      `}</style>
		</div>
	);
}
