"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
	Loader2,
	Plus,
	X,
	Activity,
	Ghost,
	Sliders,
	Check,
	RefreshCw,
	Sparkles,
	Target,
	Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface SweepLog {
	id: string;
	ran_at: string;
	jobs_found: number;
	jobs_saved: number;
	high_matches: number;
	status: string;
	query_used: string;
	error_message?: string;
}

const AVAILABLE_ROLES = [
	"Design Engineer",
	"Product Designer",
	"UI/UX Designer",
	"Frontend Engineer",
	"AI Engineer",
	"Full-stack",
];

const SUGGESTED_ROLES = [
	"Design Engineer",
	"Product Designer",
	"UI/UX Designer",
	"UX Researcher",
	"Frontend Engineer",
	"Frontend Developer",
	"React Developer",
	"Backend Engineer",
	"Full-stack Developer",
	"Full-stack Engineer",
	"AI Engineer",
	"ML Engineer",
	"Machine Learning Engineer",
	"Data Scientist",
	"Mobile Developer",
	"iOS Developer",
	"Android Developer",
	"DevOps Engineer",
	"Site Reliability Engineer",
	"Product Manager",
	"Technical Program Manager",
	"Engineering Manager",
	"QA Engineer",
	"Software Engineer",
];

const AVAILABLE_EXPERIENCES = [
	"Entry-level",
	"Junior",
	"Mid-level",
	"Senior",
	"Lead",
];

const DEFAULT_LOCATIONS = [
	"Remote India",
	"Remote",
	"Pune",
	"Hybrid",
	"On-site",
];

const SUGGESTED_LOCATIONS = [
	"Remote",
	"Remote India",
	"Hybrid",
	"On-site",
	"Pune",
	"Bangalore",
	"Bengaluru",
	"Mumbai",
	"Hyderabad",
	"Delhi",
	"New Delhi",
	"Noida",
	"Gurugram",
	"Gurgaon",
	"Chennai",
	"Kolkata",
	"Ahmedabad",
	"San Francisco",
	"New York",
	"London",
	"Seattle",
	"Singapore",
	"Berlin",
	"Toronto",
];

export default function CommandCenterPage() {
	const [roles, setRoles] = useState<string[]>([]);
	const [locations, setLocations] = useState<string[]>([]);
	const [experiences, setExperiences] = useState<string[]>([]);

	// Search/Autocomplete states
	const [customRole, setCustomRole] = useState("");
	const [showRoleSuggestions, setShowRoleSuggestions] = useState(false);
	const [roleSuggestions, setRoleSuggestions] = useState<string[]>([]);
	const [activeRoleIndex, setActiveRoleIndex] = useState(0);

	const [customLoc, setCustomLoc] = useState("");
	const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
	const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
	const [activeLocationIndex, setActiveLocationIndex] = useState(0);

	const roleSuggestionsRef = useRef<HTMLDivElement>(null);
	const locationSuggestionsRef = useRef<HTMLDivElement>(null);

	const [isLoading, setIsLoading] = useState(true);
	const [isSweeping, setIsSweeping] = useState(false);
	const [sweeps, setSweeps] = useState<SweepLog[]>([]);
	const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("synced");

	// Debounce references
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isFirstLoadRef = useRef(true);

	// Handle click outside to close suggestions
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				roleSuggestionsRef.current &&
				!roleSuggestionsRef.current.contains(event.target as Node)
			) {
				setShowRoleSuggestions(false);
			}
			if (
				locationSuggestionsRef.current &&
				!locationSuggestionsRef.current.contains(event.target as Node)
			) {
				setShowLocationSuggestions(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// ---- Fetch preferences on mount ----
	useEffect(() => {
		async function loadData() {
			try {
				setIsLoading(true);
				// 1. Fetch user profile configurations
				const res = await fetch("/api/profile/update");
				const data = await res.json();
				if (data?.profile) {
					const p = data.profile;
					setRoles(p.preferred_roles || ["Design Engineer"]);
					setLocations(p.preferred_location || ["Remote India"]);
					setExperiences(p.preferred_experience || ["Entry-level", "Junior", "Mid-level"]);
				}

				// 2. Fetch recent sweeps history
				const { data: sweepLogs, error } = await supabase
					.from("ghost_sweeps")
					.select("*")
					.order("ran_at", { ascending: false })
					.limit(5);

				if (!error && sweepLogs) {
					setSweeps(sweepLogs as SweepLog[]);
				}
			} catch (err) {
				console.error("Failed to load command center data:", err);
			} finally {
				setIsLoading(false);
			}
		}

		loadData();
	}, []);

	// ---- Debounced Database Sync ----
	const dispatchSync = useCallback((nextRoles: string[], nextLocs: string[], nextExp: string[]) => {
		if (isFirstLoadRef.current) {
			isFirstLoadRef.current = false;
			return;
		}

		setSyncStatus("syncing");
		if (timerRef.current) clearTimeout(timerRef.current);

		timerRef.current = setTimeout(async () => {
			try {
				const res = await fetch("/api/profile/update", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						preferred_roles: nextRoles,
						preferred_location: nextLocs,
						preferred_experience: nextExp,
					}),
				});

				const data = await res.json();
				if (!res.ok) throw new Error(data.error || "Failed to update profile");

				setSyncStatus("synced");
				toast.success("Preferences synced with database", {
					id: "command-center-sync",
					duration: 2000,
				});
			} catch (err: any) {
				setSyncStatus("error");
				toast.error(`Sync failed: ${err.message}`, {
					id: "command-center-sync",
				});
			}
		}, 600);
	}, []);

	// ---- Interaction handlers ----
	const toggleRole = (role: string) => {
		const next = roles.includes(role)
			? roles.filter((r) => r !== role)
			: [...roles, role];
		setRoles(next);
		dispatchSync(next, locations, experiences);
	};

	const removeRole = (role: string) => {
		const next = roles.filter((r) => r !== role);
		setRoles(next);
		dispatchSync(next, locations, experiences);
	};

	const toggleExperience = (exp: string) => {
		const next = experiences.includes(exp)
			? experiences.filter((e) => e !== exp)
			: [...experiences, exp];
		setExperiences(next);
		dispatchSync(roles, locations, next);
	};

	const toggleLocation = (loc: string) => {
		const next = locations.includes(loc)
			? locations.filter((l) => l !== loc)
			: [...locations, loc];
		setLocations(next);
		dispatchSync(roles, next, experiences);
	};

	const addCustomLocation = (e?: React.FormEvent) => {
		e?.preventDefault();
		const trimmed = customLoc.trim();
		if (!trimmed) return;

		if (!locations.includes(trimmed)) {
			const next = [...locations, trimmed];
			setLocations(next);
			dispatchSync(roles, next, experiences);
		}
		setCustomLoc("");
		setShowLocationSuggestions(false);
	};

	const addCustomRole = (e?: React.FormEvent) => {
		e?.preventDefault();
		const trimmed = customRole.trim();
		if (!trimmed) return;

		if (!roles.includes(trimmed)) {
			const next = [...roles, trimmed];
			setRoles(next);
			dispatchSync(next, locations, experiences);
		}
		setCustomRole("");
		setShowRoleSuggestions(false);
	};

	const removeLocation = (loc: string) => {
		const next = locations.filter((l) => l !== loc);
		setLocations(next);
		dispatchSync(roles, next, experiences);
	};

	// ---- Autocomplete handlers ----
	const handleRoleInputChange = async (val: string) => {
		setCustomRole(val);
		if (val.trim().length >= 3) {
			try {
				const res = await fetch(`/api/autocomplete?type=roles&q=${encodeURIComponent(val)}`);
				const data = await res.json();
				if (data.suggestions) {
					const filtered = data.suggestions.filter((r: string) => !roles.includes(r));
					const hasExact = filtered.some((r: string) => r.toLowerCase() === val.trim().toLowerCase());
					const finalSuggestions = [...filtered];
					if (!hasExact && val.trim().length > 0) {
						finalSuggestions.push(`Add "${val.trim()}"`);
					}
					setRoleSuggestions(finalSuggestions);
					setShowRoleSuggestions(true);
					setActiveRoleIndex(0);
				}
			} catch (err) {
				console.error("Error fetching role suggestions:", err);
			}
		} else {
			setShowRoleSuggestions(false);
		}
	};

	const handleLocationInputChange = async (val: string) => {
		setCustomLoc(val);
		if (val.trim().length >= 3) {
			try {
				const res = await fetch(`/api/autocomplete?type=locations&q=${encodeURIComponent(val)}`);
				const data = await res.json();
				if (data.suggestions) {
					const filtered = data.suggestions.filter((l: string) => !locations.includes(l));
					const hasExact = filtered.some((l: string) => l.toLowerCase() === val.trim().toLowerCase());
					const finalSuggestions = [...filtered];
					if (!hasExact && val.trim().length > 0) {
						finalSuggestions.push(`Add "${val.trim()}"`);
					}
					setLocationSuggestions(finalSuggestions);
					setShowLocationSuggestions(true);
					setActiveLocationIndex(0);
				}
			} catch (err) {
				console.error("Error fetching location suggestions:", err);
			}
		} else {
			setShowLocationSuggestions(false);
		}
	};

	const selectRoleSuggestion = (suggestion: string) => {
		let finalVal = suggestion;
		if (suggestion.startsWith('Add "') && suggestion.endsWith('"')) {
			finalVal = suggestion.slice(5, -1);
		}
		if (finalVal && !roles.includes(finalVal)) {
			const next = [...roles, finalVal];
			setRoles(next);
			dispatchSync(next, locations, experiences);
		}
		setCustomRole("");
		setShowRoleSuggestions(false);
	};

	const selectLocationSuggestion = (suggestion: string) => {
		let finalVal = suggestion;
		if (suggestion.startsWith('Add "') && suggestion.endsWith('"')) {
			finalVal = suggestion.slice(5, -1);
		}
		if (finalVal && !locations.includes(finalVal)) {
			const next = [...locations, finalVal];
			setLocations(next);
			dispatchSync(roles, next, experiences);
		}
		setCustomLoc("");
		setShowLocationSuggestions(false);
	};

	const handleRoleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (!showRoleSuggestions) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveRoleIndex((prev) => (prev + 1) % roleSuggestions.length);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveRoleIndex((prev) => (prev - 1 + roleSuggestions.length) % roleSuggestions.length);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (roleSuggestions[activeRoleIndex]) {
				selectRoleSuggestion(roleSuggestions[activeRoleIndex]);
			}
		} else if (e.key === "Escape") {
			setShowRoleSuggestions(false);
		}
	};

	const handleLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (!showLocationSuggestions) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveLocationIndex((prev) => (prev + 1) % locationSuggestions.length);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveLocationIndex((prev) => (prev - 1 + locationSuggestions.length) % locationSuggestions.length);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (locationSuggestions[activeLocationIndex]) {
				selectLocationSuggestion(locationSuggestions[activeLocationIndex]);
			}
		} else if (e.key === "Escape") {
			setShowLocationSuggestions(false);
		}
	};

	// ---- Trigger dynamic sweep ----
	const handleManualSweep = async () => {
		if (isSweeping) return;
		setIsSweeping(true);
		const toastId = toast.loading("Launching dynamic Ghost Scouter...", {
			description: "Querying active DB preferences across pipeline sources.",
		});

		try {
			const res = await fetch("/api/ghost/trigger", { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to trigger sweep");

			toast.success("Ghost Scout sweep completed successfully!", {
				id: toastId,
				description: "New matched jobs are available in Casual Browse.",
			});

			// Re-fetch sweep history logs
			const { data: sweepLogs } = await supabase
				.from("ghost_sweeps")
				.select("*")
				.order("ran_at", { ascending: false })
				.limit(5);
			if (sweepLogs) {
				setSweeps(sweepLogs as SweepLog[]);
			}
		} catch (err: any) {
			toast.error(`Sweep failed to complete: ${err.message}`, { id: toastId });
		} finally {
			setIsSweeping(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex h-screen items-center justify-center surface-0">
				<Loader2 className="h-6 w-6 animate-spin text-mint" />
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-auto p-8 relative min-h-screen surface-0 text-foreground">
			{/* Ambient grid glow */}
			<div
				className="pointer-events-none fixed inset-0 -z-10"
				style={{
					background:
						"radial-gradient(ellipse 70% 50% at 50% -10%, rgba(16,185,129,0.03) 0%, transparent 60%)",
				}}
			/>

			<div className="mx-auto max-w-6xl space-y-8">
				{/* Page Header */}
				<header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
					<div>
						<h1 className="text-3xl font-black tracking-tighter text-text-1">
							Command Center
						</h1>
						<p className="text-xs font-semibold text-text-3 mt-1 uppercase tracking-widest">
							Scouter Dashboard v1.0 • Pipeline Configuration
						</p>
					</div>

					{/* Trigger Button */}
					<button
						onClick={handleManualSweep}
						disabled={isSweeping}
						className="flex items-center justify-center gap-2 rounded-lg border border-mint/20 bg-mint-dim px-4 py-2.5 text-xs font-black uppercase tracking-widest text-mint transition-all duration-300 hover:bg-mint hover:text-black hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
					>
						{isSweeping ? (
							<Loader2 size={13} className="animate-spin" />
						) : (
							<Ghost size={13} />
						)}
						{isSweeping ? "Scouting..." : "Trigger Manual Sweep"}
					</button>
				</header>

				{/* Bento Grid */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					{/* Left Bento: Ghost Scouter Configuration Card (spans 2 columns) */}
					<div
						className="lg:col-span-2 obsidian-card p-6 flex flex-col gap-6 relative overflow-hidden"
						style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}
					>
						{/* Spotlight Top Accent */}
						<div
							className="absolute inset-0 opacity-10 pointer-events-none"
							style={{
								background:
									"radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16,185,129,0.15) 0%, transparent 70%)",
							}}
						/>

						{/* Card Header & Sync Indicator */}
						<div className="flex items-center justify-between border-b border-subtle pb-4 relative z-10">
							<div>
								<h2 className="text-lg font-black tracking-tight text-text-1 flex items-center gap-2">
									<Sliders className="h-4.5 w-4.5 text-mint" />
									Ghost Scouter Configuration
								</h2>
								<p className="text-[11px] font-medium text-text-3 mt-0.5">
									Dynamic targeting parameters for auto-scouted feeds
								</p>
							</div>

							{/* Sync Status Badge */}
							<div className="flex items-center gap-1.5 shrink-0 select-none">
								{syncStatus === "syncing" && (
									<span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
										<Loader2 size={11} className="animate-spin" />
										Syncing...
									</span>
								)}
								{syncStatus === "synced" && (
									<span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-mint">
										<span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse" />
										Preferences Synced
									</span>
								)}
								{syncStatus === "error" && (
									<span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-400">
										<span className="h-1.5 w-1.5 rounded-full bg-red-500" />
										Sync Error
									</span>
								)}
							</div>
						</div>

						{/* Card Form Inputs */}
						<div className="space-y-6 relative z-10 flex-1">
							{/* 1. Target Roles */}
							<div className="space-y-2.5">
								<span className="text-[10px] font-bold uppercase tracking-widest text-text-3">
									Target Roles
								</span>
								
								{/* Pill List of Roles */}
								<div className="flex flex-wrap gap-2">
									{Array.from(new Set([...AVAILABLE_ROLES, ...roles])).map((role) => {
										const active = roles.includes(role);
										return (
											<button
												key={role}
												onClick={() => toggleRole(role)}
												className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all border duration-200 ${
													active
														? "bg-mint-dim text-mint border-focus"
														: "bg-white/5 text-white/40 border-white/5 hover:bg-white/[0.08] hover:text-white/70"
												}`}
											>
												{role}
											</button>
										);
									})}
								</div>

								{/* Add Custom Role with Autocomplete */}
								<div className="relative max-w-sm mt-3">
									<form onSubmit={addCustomRole} className="flex gap-2">
										<input
											type="text"
											value={customRole}
											onChange={(e) => handleRoleInputChange(e.target.value)}
											onKeyDown={handleRoleKeyDown}
											onFocus={() => {
												if (customRole.trim().length >= 3) setShowRoleSuggestions(true);
											}}
											placeholder="Search & add target role (e.g. Backend Engineer)..."
											className="flex-1 rounded-md px-3 h-8 text-xs font-medium focus:outline-none transition-all surface-3 border border-subtle text-text-1 focus:border-strong focus:bg-white/[0.02]"
										/>
										<button
											type="submit"
											className="px-3 h-8 rounded-md text-xs font-bold transition-all bg-white/5 hover:bg-white/[0.08] border border-subtle text-text-1 flex items-center justify-center"
										>
											<Plus size={13} />
										</button>
									</form>

									{/* Autocomplete suggestions */}
									{showRoleSuggestions && roleSuggestions.length > 0 && (
										<div
											ref={roleSuggestionsRef}
											className="absolute top-9 left-0 right-0 z-50 rounded-lg border border-subtle p-1 shadow-2xl backdrop-blur-xl max-h-60 overflow-y-auto"
											style={{ background: "rgba(14, 14, 14, 0.95)" }}
										>
											{roleSuggestions.map((suggestion, index) => (
												<button
													key={suggestion}
													type="button"
													onClick={() => selectRoleSuggestion(suggestion)}
													onMouseEnter={() => setActiveRoleIndex(index)}
													className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
														index === activeRoleIndex
															? "bg-mint-dim text-mint"
															: "text-text-2 hover:bg-white/5"
													}`}
												>
													{suggestion}
												</button>
											))}
										</div>
									)}
								</div>
							</div>

							{/* 2. Target Experience Level */}
							<div className="space-y-2.5">
								<span className="text-[10px] font-bold uppercase tracking-widest text-text-3">
									Target Experience Level
								</span>
								<div className="flex flex-wrap gap-2">
									{AVAILABLE_EXPERIENCES.map((exp) => {
										const active = experiences.includes(exp);
										return (
											<button
												key={exp}
												onClick={() => toggleExperience(exp)}
												className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all border duration-200 ${
													active
														? "bg-mint-dim text-mint border-focus"
														: "bg-white/5 text-white/40 border-white/5 hover:bg-white/[0.08] hover:text-white/70"
												}`}
											>
												{exp}
											</button>
										);
									})}
								</div>
							</div>

							{/* 3. Target Locations */}
							<div className="space-y-2.5">
								<span className="text-[10px] font-bold uppercase tracking-widest text-text-3">
									Target Locations
								</span>

								{/* Pill List of Locations */}
								<div className="flex flex-wrap gap-2">
									{Array.from(new Set([...DEFAULT_LOCATIONS, ...locations])).map((loc) => {
										const active = locations.includes(loc);
										return (
											<button
												key={loc}
												onClick={() => toggleLocation(loc)}
												className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all border duration-200 ${
													active
														? "bg-mint-dim text-mint border-focus"
														: "bg-white/5 text-white/40 border-white/5 hover:bg-white/[0.08] hover:text-white/70"
												}`}
											>
												{loc}
											</button>
										);
									})}
								</div>

								{/* Add Custom Location with Autocomplete */}
								<div className="relative max-w-sm mt-3">
									<form onSubmit={addCustomLocation} className="flex gap-2">
										<input
											type="text"
											value={customLoc}
											onChange={(e) => handleLocationInputChange(e.target.value)}
											onKeyDown={handleLocationKeyDown}
											onFocus={() => {
												if (customLoc.trim().length >= 3) setShowLocationSuggestions(true);
											}}
											placeholder="Add custom location (e.g. Pune, Bangalore)..."
											className="flex-1 rounded-md px-3 h-8 text-xs font-medium focus:outline-none transition-all surface-3 border border-subtle text-text-1 focus:border-strong focus:bg-white/[0.02]"
										/>
										<button
											type="submit"
											className="px-3 h-8 rounded-md text-xs font-bold transition-all bg-white/5 hover:bg-white/[0.08] border border-subtle text-text-1 flex items-center justify-center"
										>
											<Plus size={13} />
										</button>
									</form>

									{/* Autocomplete suggestions */}
									{showLocationSuggestions && locationSuggestions.length > 0 && (
										<div
											ref={locationSuggestionsRef}
											className="absolute top-9 left-0 right-0 z-50 rounded-lg border border-subtle p-1 shadow-2xl backdrop-blur-xl max-h-60 overflow-y-auto"
											style={{ background: "rgba(14, 14, 14, 0.95)" }}
										>
											{locationSuggestions.map((suggestion, index) => (
												<button
													key={suggestion}
													type="button"
													onClick={() => selectLocationSuggestion(suggestion)}
													onMouseEnter={() => setActiveLocationIndex(index)}
													className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
														index === activeLocationIndex
															? "bg-mint-dim text-mint"
															: "text-text-2 hover:bg-white/5"
													}`}
												>
													{suggestion}
												</button>
											))}
										</div>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Right Bento: Ghost Status & Sweep History Card (spans 1 column) */}
					<div
						className="obsidian-card p-6 flex flex-col gap-6"
						style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}
					>
						<div>
							<h2 className="text-lg font-black tracking-tight text-text-1 flex items-center gap-2">
								<Activity className="h-4.5 w-4.5 text-mint" />
								Sweep Activity Log
							</h2>
							<p className="text-[11px] font-medium text-text-3 mt-0.5">
								Recent results from the background worker daemon
							</p>
						</div>

						{/* Sweeps history list */}
						<div className="flex-1 flex flex-col gap-3 min-h-[300px]">
							{sweeps.map((s) => {
								const timeString = new Date(s.ran_at).toLocaleTimeString([], {
									hour: "2-digit",
									minute: "2-digit",
								});
								const dateString = new Date(s.ran_at).toLocaleDateString([], {
									month: "short",
									day: "numeric",
								});

								return (
									<div
										key={s.id}
										className="p-3.5 rounded-lg border border-subtle surface-3 flex flex-col gap-2 relative overflow-hidden"
									>
										<div className="flex items-center justify-between">
											<span className="text-[10px] font-mono font-bold text-mint uppercase tracking-wider">
												{dateString} · {timeString}
											</span>
											<span
												className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest ${
													s.status === "success"
														? "bg-mint-dim text-mint"
														: "bg-red-500/10 text-red-400"
												}`}
											>
												{s.status}
											</span>
										</div>

										<div className="flex items-end justify-between">
											<div className="flex flex-col gap-0.5">
												<span className="text-[10px] font-bold uppercase tracking-widest text-text-4">
													Detections
												</span>
												<span className="text-[16px] font-black text-text-1 leading-none">
													{s.jobs_found}{" "}
													<span className="text-xs font-semibold text-text-3">found</span>
												</span>
											</div>
											<div className="flex flex-col gap-0.5 items-end">
												<span className="text-[10px] font-bold uppercase tracking-widest text-text-4">
													Saved
												</span>
												<span className="text-[16px] font-black text-mint leading-none">
													+{s.jobs_saved}{" "}
													<span className="text-xs font-semibold text-text-3">added</span>
												</span>
											</div>
										</div>

										{s.query_used && (
											<div className="text-[9px] font-medium text-text-4 border-t border-white/[0.04] pt-2 truncate mt-1">
												<span className="font-bold">Queries:</span> {s.query_used}
											</div>
										)}
									</div>
								);
							})}

							{sweeps.length === 0 && (
								<div className="flex-1 flex flex-col items-center justify-center p-8 rounded-lg border border-subtle border-dashed bg-white/[0.01]">
									<Ghost size={24} className="text-text-4 opacity-50 mb-2 animate-bounce" />
									<span className="text-xs font-bold text-text-3 uppercase tracking-wider">
										No Sweep History
									</span>
									<span className="text-[10px] text-text-4 text-center mt-1">
										Trigger a sweep above to populate scouter logs.
									</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
