"use client";

import { useEffect, useRef, useState } from "react";
import { JobPost } from "@/types/job";
import { JobCard } from "./JobCard";
import { JobInsightSheet } from "./JobInsightSheet";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowUp } from "lucide-react";
import { toast } from "sonner";

function formatRelativeTime(dateString?: string): string | null {
	if (!dateString) return null;
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return null;

	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	
	// Handle negative difference due to slight clock drift
	if (diffMs < 0) {
		if (Math.abs(diffMs) < 5 * 60 * 1000) {
			return "Found just now";
		}
		return null;
	}

	const diffHours = diffMs / (1000 * 60 * 60);
	if (diffHours >= 24) {
		return null; // Older than 24 hours, hide entirely
	}

	const diffMins = Math.floor(diffMs / (1000 * 60));
	if (diffMins < 1) {
		return "Found just now";
	}
	if (diffMins < 60) {
		return `Found ${diffMins}m ago`;
	}

	const hours = Math.floor(diffHours);
	return `Found ${hours}h ago`;
}

function getRelativeTimeBadge(job: any): string | null {
	const timestamp = job.created_at || job.inserted_at || job.posted_at;
	return formatRelativeTime(timestamp);
}

export function JobGrid() {
	const [selectedJob, setSelectedJob] = useState<JobPost | null>(null);
	const [jobs, setJobs] = useState<JobPost[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [newJobIds, setNewJobIds] = useState<Set<string>>(new Set());
	const [stagedJobs, setStagedJobs] = useState<JobPost[]>([]);
	const topRef = useRef<HTMLDivElement>(null);

	async function fetchJobs() {
		try {
			setIsLoading(true);
			const { data, error } = await supabase
				.from("jobs")
				.select("*")
				.eq("status", "casual")
				.order("created_at", { ascending: false });

			if (error) throw error;
			setJobs((data || []) as JobPost[]);
		} catch (err) {
			console.error("Error fetching jobs:", err);
			setJobs([]);
		} finally {
			setIsLoading(false);
		}
	}

	const hasFetched = useRef(false);
	useEffect(() => {
		if (hasFetched.current) return;
		hasFetched.current = true;

		fetchJobs();

		const channel = supabase
			.channel("jobs_casuals_realtime")
			.on(
				"postgres_changes",
				{ event: "INSERT", schema: "public", table: "jobs" },
				(payload) => {
					const newJob = payload.new as JobPost;

					// Only inject into Casual grid if status is casual
					if (newJob.status === "casual") {
						setStagedJobs((prev) => {
							if (prev.some((j) => j.id === newJob.id)) return prev;
							return [newJob, ...prev];
						});

						// Ghost-scouted job: show celebration toast
						if (
							newJob?.source === "ghost" ||
							newJob?.source === "serper" ||
							newJob?.source === "remoteok" ||
							newJob?.source === "remotive"
						) {
							const score = newJob.match_score ?? 0;
							const emoji = score >= 95 ? "🦄" : score >= 85 ? "🔥" : "👻";
							toast.success(`${emoji} Ghost found a ${score}% match!`, {
								description: `${newJob.role ?? "New job"} at ${(newJob.company as { name?: string })?.name ?? "Unknown"}`,
								duration: 6000,
								action: {
									label: "View",
									onClick: () => setSelectedJob(newJob),
								},
							});
						}
					}
				},
			)
			.on(
				"postgres_changes",
				{ event: "UPDATE", schema: "public", table: "jobs" },
				(payload) => {
					const updatedJob = payload.new as JobPost;
					if (updatedJob.status !== "casual") {
						// If promoted, remove from casual list
						setJobs((prev) => prev.filter((j) => j.id !== updatedJob.id));
					} else {
						// Update in place
						setJobs((prev) =>
							prev.map((j) => (j.id === updatedJob.id ? updatedJob : j))
						);
					}
				},
			)
			.subscribe();

		window.addEventListener("scout-refresh", fetchJobs);

		return () => {
			supabase.removeChannel(channel);
			window.removeEventListener("scout-refresh", fetchJobs);
		};
	}, []);

	return (
		<div className="relative" ref={topRef}>
			{/* Staging Queue Floating Pill */}
			{stagedJobs.length > 0 && (
				<button
					onClick={() => {
						// Merge staged jobs
						setJobs((prev) => [...stagedJobs, ...prev]);

						// Highlight the newly merged jobs
						const stagedIds = stagedJobs.map((j) => j.id).filter(Boolean) as string[];
						if (stagedIds.length > 0) {
							setNewJobIds((prev) => new Set([...prev, ...stagedIds]));
							setTimeout(() => {
								setNewJobIds((prev) => {
									const next = new Set(prev);
									stagedIds.forEach((id) => next.delete(id));
									return next;
								});
							}, 4000);
						}

						// Clear the queue and scroll window to top smoothly
						setStagedJobs([]);
						window.scrollTo({ top: 0, behavior: "smooth" });
					}}
					className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-[var(--mint)] text-[#050505] font-bold text-xs px-5 py-2 rounded-full shadow-[0_4px_20px_var(--mint-strong)] cursor-pointer hover:scale-105 transition-all duration-200 ease-out flex items-center gap-2 animate-in slide-in-from-top-4"
				>
					<ArrowUp strokeWidth={2} size={14} />
					<span>{stagedJobs.length} new jobs found</span>
				</button>
			)}

			{isLoading ? (
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-5 w-5 animate-spin text-foreground/20" />
				</div>
			) : jobs.length === 0 ? (
				<div
					className="p-12 rounded-2xl border text-center mt-6"
					style={{
						background: "var(--surface-3)",
						borderColor: "var(--border-default)",
					}}
				>
					<p className="text-3xl mb-3">👻</p>
					<h3
						className="text-sm font-bold uppercase tracking-widest"
						style={{ color: "#71717A" }}
					>
						Ghost is warming up
					</h3>
					<p className="mt-2 text-sm font-medium" style={{ color: "#A1A1AA" }}>
						The nightly sweep runs at 9:00 AM IST. Paste a URL above to scout
						manually now.
					</p>
				</div>
			) : (
				<div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
					{jobs.map((job) => (
						<div
							key={job.id}
							className="relative transition-all duration-500"
							style={
								newJobIds.has(job.id)
									? {
											outline: "1px solid var(--border-strong)",
											borderRadius: "1rem",
											boxShadow: "0 0 20px rgba(255,255,255,0.05)",
										}
									: {}
							}
						>
							{/* Dynamic relative time badge (replaces static GHOST badge) */}
							{(() => {
								const timeBadge = getRelativeTimeBadge(job);
								if (!timeBadge) return null;
								return (
									<span
										className="absolute -top-2 -right-2 z-10 text-[10px] font-mono px-2 py-0.5 rounded bg-mint-dim text-mint border border-mint/30"
									>
										{timeBadge}
									</span>
								);
							})()}
							<JobCard job={job} onClick={(j) => setSelectedJob(j)} />
						</div>
					))}
				</div>
			)}

			<JobInsightSheet
				open={!!selectedJob}
				job={selectedJob}
				onClose={() => setSelectedJob(null)}
			/>
		</div>
	);
}
