"use client";

import { useState, useRef } from "react";
import { JobPost } from "@/types/job";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Info, Loader2, Sparkles, MapPin, IndianRupee } from "lucide-react";
// Force HMR re-evaluation of date-fns
import { formatDistanceToNow } from "date-fns";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cleanCompanyName, cleanJobRole, cleanJobDescription } from "@/lib/format-job";

// ─── Score badge helpers ───────────────────────────────────────────────────────
function getScoreStyle(score: number): {
	color: string;
	background: string;
	border: string;
} {
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

function ScoreBadge({ score }: { score: number }) {
	const style = getScoreStyle(score);
	return (
		<div
			className="score-badge flex items-center gap-0.5 rounded-md px-2 py-1"
			style={style}
			title={`Match score: ${score}%`}
		>
			<span className="text-[11px] font-bold">{score}</span>
			<span className="text-[9px] font-bold opacity-80">%</span>
		</div>
	);
}

// ─── Inline badge (remote, salary, tech) ─────────────────────────────────────
function Chip({
	children,
	primary,
}: {
	children: React.ReactNode;
	primary?: boolean;
}) {
	return (
		<span
			className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[9px] font-medium tracking-tight leading-none uppercase"
			style={{
				background: primary ? "rgba(255,255,255,0.03)" : "transparent",
				border: "1px solid rgba(255,255,255,0.1)",
				color: primary ? "var(--foreground)" : "var(--text-3)",
			}}
		>
			{children}
		</span>
	);
}

// ─── Remote status dot + label ───────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
	Remote: "#34D399",
	Hybrid: "#60A5FA",
	"On-site": "#FBBF24",
};
const STATUS_DOT: Record<string, string> = {
	Remote: "#10B981",
	Hybrid: "#3B82F6",
	"On-site": "#F59E0B",
};

function RemoteChip({ status }: { status: string }) {
	return (
		<span
			className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9px] font-bold tracking-tight leading-none uppercase"
			style={{
				background: "rgba(255,255,255,0.03)",
				border: "1px solid rgba(255,255,255,0.08)",
				color: "var(--text-2)",
			}}
		>
			<span className="h-1 w-1 rounded-full bg-foreground/40" />
			{status}
		</span>
	);
}

// ─── Main JobCard ────────────────────────────────────────────────────────────
export function JobCard({
	job: initialJob,
	onClick,
}: {
	job: JobPost;
	onClick: (job: JobPost) => void;
}) {
	const [job, setJob] = useState<JobPost>(initialJob);
	const [isRedistilling, setIsRedistilling] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

	const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		setMousePos({
			x: e.clientX - rect.left,
			y: e.clientY - rect.top,
		});
	};

	// ── Critical UUID guard ──────────────────────────────────────────────────────
	if (!job.id || typeof job.id !== "string" || job.id.trim() === "") {
		console.error(
			"[JobCard] CRITICAL: job.id is missing or invalid. " +
				"This job cannot be promoted. Check the DB insert — the 'id' column must be a valid UUID.",
			{ role: job.role, company: job.company?.name },
		);
	}

	const topTech = job.tech_stack.slice(0, 3);
	const isSalaryUndisclosed = !job.pay || (!job.pay.min && !job.pay.max) || (job.pay.min === 0 && job.pay.max === 0);
	const salaryLabel = isSalaryUndisclosed ? "Undisclosed" : `₹${job.pay.min}–${job.pay.max}L`;

	const handleApplyClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		const quickIntro = `Hi! I'm an engineer passionate about building great products. I scored a ${job.match_score}% match for the ${job.role} position at ${job.company.name} and would love to chat.`;
		navigator.clipboard.writeText(quickIntro);
		toast.success("Quick Intro copied!", {
			description: "Paste it directly into your application or email.",
		});
		window.open(job.apply_url, "_blank");
	};

	const handleRedistill = async (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsRedistilling(true);
		try {
			const res = await fetch("/api/scout/distill", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jobId: job.id }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Distill failed");

			// Merge the updated AI fields into local state so UI refreshes immediately
			setJob((prev) => ({
				...prev,
				match_score: data.job.match_score,
				match_explanation: data.job.match_explanation,
				missing_skills: data.job.missing_skills ?? [],
				description: data.job.description,
			}));
			toast.success("Re-distilled!", {
				description: `New match: ${data.job.match_score}% · Explanation updated.`,
			});
		} catch (err: any) {
			toast.error("Re-distill failed", { description: err.message });
		} finally {
			setIsRedistilling(false);
		}
	};

	return (
		<article
			ref={containerRef}
			id={`job-card-${job.id}`}
			role="button"
			tabIndex={0}
			onClick={() => onClick(job)}
			onKeyDown={(e) => e.key === "Enter" && onClick(job)}
			onMouseMove={handleMouseMove}
			className="group relative flex cursor-pointer flex-col gap-4 rounded-xl p-6 transition-all duration-150 ease-out hover:bg-white/[0.03] hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-1 overflow-hidden h-full justify-between animate-in fade-in slide-in-from-top-4 duration-300"
			style={{
				background: "var(--surface-2)",
				border: "1px solid var(--border-default)",
				["--tw-ring-color" as string]: "var(--foreground)",
			}}
		>
			{/* Spotlight Effect */}
			<div
				className="pointer-events-none absolute inset-0 transition-opacity duration-300 opacity-0 group-hover:opacity-100"
				style={{
					background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.06), transparent 80%)`,
				}}
			/>
			{/* Border Highlight (Spotlight) */}
			<div
				className="pointer-events-none absolute -inset-px rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
				style={{
					background: `radial-gradient(100px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.15), transparent 80%)`,
					padding: "1px",
					WebkitMask:
						"linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
					WebkitMaskComposite: "destination-out",
					maskComposite: "exclude",
				}}
			/>
			{/* Stale indicator dot */}
			{job.match_stale && (
				<span
					className="absolute top-3 right-3 h-1.5 w-1.5 rounded-full"
					style={{ background: "#F59E0B" }}
					title="Match score is stale — profile updated"
				/>
			)}

			{/* Hover Ingestion Timestamp */}
			{job.created_at && (
				<span className="absolute top-3 right-3 text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-2)] border border-[var(--border-subtle)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out z-20 pointer-events-none">
					Found {formatDistanceToNow(new Date(job.created_at))} ago
				</span>
			)}

			{/* ── Top Details Container (Company, Title, Stats Row) ── */}
			<div className="flex flex-col gap-4 relative z-10 flex-1">
				{/* ── 1. Company Name & Title ────────────────────────────────────── */}
				<div className="flex flex-col gap-1">
					<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-3)] group-hover:text-foreground/60 transition-colors">
						{cleanJobRole(job.role)}
					</p>
					<div className="flex items-start justify-between gap-2">
						<h3
							className="text-lg font-bold tracking-tight text-[var(--text-1)] leading-snug line-clamp-2 text-ellipsis overflow-hidden flex-1"
							style={{ minHeight: "3.5rem" }}
						>
							{cleanCompanyName(job.company?.name || (job as any).company, job.role)}
						</h3>
						<div onClick={(e) => e.stopPropagation()} className="shrink-0 pt-0.5">
							<Popover>
								<PopoverTrigger
									className="transition-colors flex items-center justify-center p-1 rounded hover:bg-white/5"
									style={{ color: "var(--text-3)" }}
								>
									<Info size={14} />
								</PopoverTrigger>
								<PopoverContent
									className="w-80 p-5 text-sm z-[9999] shadow-2xl rounded-xl backdrop-blur-xl"
									style={{
										background: "rgba(9, 9, 11, 0.95)",
										borderColor: "rgba(255,255,255,0.1)",
										color: "var(--foreground)",
									}}
								>
									<div className="space-y-4">
										<div>
											<h4
												className="text-[11px] font-bold uppercase tracking-widest mb-2 text-[var(--text-3)]"
											>
												Why this match?
											</h4>
											{job.match_explanation ? (
												<p className="text-[12.5px] leading-relaxed font-medium text-[var(--text-2)]">
													{job.match_explanation}
												</p>
											) : (
												<div className="space-y-3">
													<p className="text-[12px] italic text-[var(--text-3)]">
														No explanation available for this match.
													</p>
													<button
														onClick={handleRedistill}
														disabled={isRedistilling}
														className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold tracking-tight uppercase transition-all bg-white/5 hover:bg-white/10 border border-white/10 text-white"
													>
														{isRedistilling ? (
															<><Loader2 size={11} className="animate-spin" /> Re-distilling…</>
														) : (
															<><Sparkles size={11} /> ✨ Re-distill Job</>
														)}
													</button>
												</div>
											)}
										</div>

										{job.missing_skills && job.missing_skills.length > 0 && (
											<div>
												<h4 className="text-[11px] font-bold uppercase tracking-widest mb-2 text-[var(--text-3)]">
													Skill Gaps
												</h4>
												<div className="flex flex-wrap gap-1">
													{job.missing_skills.map((skill) => (
														<Badge
															key={skill}
															className="text-[10px] font-semibold px-1.5 py-0.5"
															style={{
																background: "rgba(239,68,68,0.12)",
																border: "1px solid rgba(239,68,68,0.25)",
																color: "#FCA5A5",
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
					</div>
				</div>

				{/* ── 2. Core Stats Row ──────────────────────────────────────────── */}
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold text-[var(--text-2)]">
					{/* Location */}
					<div className="flex items-center gap-1">
						<MapPin size={13} strokeWidth={1.5} className="text-[var(--text-3)] shrink-0" />
						<span>{job.remote_status} · {job.location.split(",")[0]}</span>
					</div>

					{/* Salary */}
					<div className="flex items-center gap-1">
						<IndianRupee size={13} strokeWidth={1.5} className="text-[var(--text-3)] shrink-0" />
						<span className={isSalaryUndisclosed ? "text-[var(--text-3)]" : ""}>{salaryLabel}</span>
					</div>

					{/* Match Score */}
					<div className="flex items-center gap-1">
						<Sparkles
							size={13}
							strokeWidth={1.5}
							className={`shrink-0 ${job.match_score >= 80 ? "text-mint" : "text-[var(--text-3)]"}`}
						/>
						<span className={job.match_score >= 80 ? "text-mint font-bold" : ""}>
							{job.match_score}% Match
						</span>
					</div>
				</div>
			</div>

			{/* ── Bottom Section Container (Snippet/Footer) ── */}
			<div className="flex flex-col gap-4 mt-2 relative z-10 shrink-0">
				{/* ── 3. Description excerpt ── */}
				<p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-3)] group-hover:text-[var(--text-2)] font-medium transition-colors duration-150">
					{cleanJobDescription(job.description)}
				</p>

				{/* ── Hover CTAs ── */}
				<div className="flex opacity-0 group-hover:opacity-100 transition-opacity duration-150">
					<Button
						size="sm"
						className="w-full text-[10px] font-black uppercase tracking-widest transition-all bg-foreground text-background hover:opacity-90"
						onClick={handleApplyClick}
					>
						Apply • Quick Intro
					</Button>
				</div>
			</div>
		</article>
	);
}
