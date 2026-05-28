"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { JobPost } from "@/types/job";
import { supabase } from "@/lib/supabase";
import { Loader2, Info, Ghost, Trash2 } from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { formatSalary } from "@/lib/format-salary";
import { toast } from "sonner";

// ─── Score badge helpers (mirrors JobCard.tsx) ────────────────────────────────
function getScoreStyle(score: number): React.CSSProperties {
	if (score >= 90)
		return {
			color: "var(--foreground)",
			background: "rgba(255,255,255,0.05)",
			border: "1px solid rgba(255,255,255,0.2)",
		};
	if (score >= 70)
		return {
			color: "var(--text-2)",
			background: "rgba(255,255,255,0.03)",
			border: "1px solid rgba(255,255,255,0.1)",
		};
	return {
		color: "var(--text-3)",
		background: "transparent",
		border: "1px solid rgba(255,255,255,0.05)",
	};
}

export default function SeriousQueuePage() {
	const [jobs, setJobs] = useState<JobPost[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isClearing, setIsClearing] = useState(false);
	const [clearConfirm, setClearConfirm] = useState(false);

	async function fetchSerious() {
		try {
			setIsLoading(true);
			const { data, error } = await supabase
				.from("jobs")
				.select("*")
				.eq("status", "serious")
				.order("created_at", { ascending: false });

			if (error) throw error;
			setJobs((data as JobPost[]) || []);
		} catch (err) {
			console.error("Error fetching serious jobs:", err);
		} finally {
			setIsLoading(false);
		}
	}

	useEffect(() => {
		fetchSerious();
	}, []);

	async function handleClearQueue() {
		if (!clearConfirm) {
			setClearConfirm(true);
			setTimeout(() => setClearConfirm(false), 3000);
			return;
		}
		setClearConfirm(false);
		setIsClearing(true);
		try {
			const res = await fetch("/api/job/clear-serious", { method: "DELETE" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to clear queue");
			setJobs([]);
			toast.success(`Queue cleared — ${data.deleted} job${data.deleted !== 1 ? "s" : ""} removed.`);
		} catch (err: any) {
			toast.error("Failed to clear queue", { description: err.message });
		} finally {
			setIsClearing(false);
		}
	}

	async function handleDeleteJob(jobId: string) {
		const toastId = toast.loading("Removing job from queue...");
		try {
			const res = await fetch("/api/job/update", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jobId, updates: { status: "removed" } }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to remove job");
			
			setJobs((prev) => prev.filter((j) => j.id !== jobId));
			toast.success("Job removed from queue", { id: toastId });
		} catch (err: any) {
			toast.error("Failed to remove job", { description: err.message, id: toastId });
		}
	}

	return (
		<div className="flex-1 overflow-auto p-8 relative">
			<div
				className="pointer-events-none fixed inset-0 -z-10"
				style={{
					background:
						"radial-gradient(ellipse 60% 40% at 50% -10%, rgba(255,255,255,0.02) 0%, transparent 80%)",
				}}
			/>

			<div className="mx-auto max-w-5xl space-y-6">
				<header className="mb-10 flex items-start justify-between gap-4">
					<div className="flex flex-col gap-1">
						<h1 className="text-[28px] font-black tracking-tighter text-foreground">
							Serious Queue
						</h1>
						<p className="text-xs font-medium text-foreground/40">
							High-match opportunities prioritized for customized applications.
						</p>
					</div>

					{/* ── Action Buttons ─────────────────────────────────────── */}
					<div className="flex items-center gap-2 pt-1 shrink-0">
						{/* Clear Queue */}
						<button
							onClick={handleClearQueue}
							disabled={isClearing}
							className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
								clearConfirm
									? "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20"
									: "border-white/[0.08] bg-white/[0.04] text-white/50 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
							}`}
						>
							{isClearing ? (
								<Loader2 size={12} className="animate-spin" />
							) : (
								<Trash2 size={12} />
							)}
							{isClearing ? "Clearing…" : clearConfirm ? "Confirm Clear?" : "Clear Queue"}
						</button>
					</div>
				</header>


				{isLoading ? (
					<div className="flex items-center justify-center p-12">
						<Loader2 className="h-6 w-6 animate-spin text-slate-400" />
					</div>
				) : jobs.length === 0 ? (
					<div
						className="p-12 rounded-2xl border text-center"
						style={{
							background: "var(--surface-3)",
							borderColor: "var(--border-default)",
						}}
					>
						<h3 className="text-[10px] font-black uppercase tracking-widest text-foreground/30">
							No serious jobs yet
						</h3>
						<p className="mt-2 text-xs font-medium text-foreground/20">
							Promote jobs from the Casual Hunt to build your pipeline.
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						{jobs.map((job) => {
							const scoreStyle = getScoreStyle(job.match_score);

							return (
								<div key={job.id} className="relative group">
									{/* Clickable row → workspace */}
									<Link
										href={`/dashboard/serious/${job.id}`}
										className="flex items-center justify-between p-6 rounded-xl transition-all duration-300 hover:bg-white/[0.02] hover:-translate-y-0.5 border border-white/[0.05]"
										style={{
											background: "var(--surface-2)",
										}}
									>
										{/* Left: company + role */}
										<div className="flex-1 min-w-0 pr-4">
											<div className="flex flex-col gap-0.5">
												<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">
													{job.company.name}
												</p>
												<h3 className="text-[17px] font-semibold tracking-tight text-foreground">
													{job.role}
												</h3>
											</div>
										</div>

										{/* Right: pay + remote + score + ⓘ */}
										<div className="flex items-center gap-4 shrink-0">
											<div className="flex flex-col items-end">
												<span className="text-xs font-bold text-foreground">
													{formatSalary(job.pay?.min)} –{" "}
													{formatSalary(job.pay?.max)}
												</span>
												<span className="text-[10px] font-bold uppercase tracking-tight text-foreground/40">
													{job.remote_status}
												</span>
											</div>

											{/* Colour-coded match score */}
											<span
												className="inline-flex items-center rounded-md px-2 py-1 text-xs font-bold tabular-nums"
												style={scoreStyle}
											>
												{job.match_score}%
											</span>

											{/* ⓘ Popover — stop propagation so Link doesn't fire */}
											<div onClick={(e) => e.preventDefault()}>
												<Popover>
													<PopoverTrigger className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1 rounded relative z-20">
														<Info size={15} />
													</PopoverTrigger>
													<PopoverContent
														className="w-80 p-5 text-sm z-[9999] shadow-2xl rounded-xl backdrop-blur-xl"
														style={{
															background: "rgba(9, 9, 11, 0.95)",
															border: "1px solid rgba(255,255,255,0.1)",
															color: "var(--foreground)",
														}}
													>
														<div className="space-y-3">
															<div>
																<h4
																	className="font-bold text-[11px] uppercase tracking-widest mb-1.5"
																	style={{ color: "#71717A" }}
																>
																	Why this job?
																</h4>
																<p
																	className="text-[12.5px] leading-relaxed font-medium"
																	style={{ color: "#A1A1AA" }}
																>
																	{job.match_explanation || (
																		<span
																			className="italic"
																			style={{ color: "#52525B" }}
																		>
																			Match explanation not available.
																		</span>
																	)}
																</p>
															</div>
															{job.missing_skills &&
																job.missing_skills.length > 0 && (
																	<div>
																		<h4
																			className="font-bold text-[11px] uppercase tracking-widest mb-1.5"
																			style={{ color: "#71717A" }}
																		>
																			Skill Gaps
																		</h4>
																		<div className="flex flex-wrap gap-1">
																			{job.missing_skills.map((skill) => (
																				<Badge
																					key={skill}
																					className="text-[10px] font-semibold px-1.5 py-0.5"
																					style={{
																						background: "rgba(239,68,68,0.12)",
																						border:
																							"1px solid rgba(239,68,68,0.25)",
																						color: "#F87171",
																					}}
																				>
																					{skill}
																				</Badge>
																			))}
																		</div>
																	</div>
																)}
														</div>
													</PopoverContent>
												</Popover>
											</div>

											{/* Delete button — stop propagation so Link doesn't fire */}
											<div onClick={(e) => e.preventDefault()}>
												<button
													onClick={() => handleDeleteJob(job.id)}
													className="text-red-400/60 hover:text-red-400 transition-colors p-1 rounded relative z-20"
													title="Remove from Serious Queue"
												>
													<Trash2 size={15} />
												</button>
											</div>
										</div>
									</Link>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
