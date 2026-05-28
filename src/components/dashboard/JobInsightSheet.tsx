"use client";

import { useState, useEffect, useCallback } from "react";
import { JobPost } from "@/types/job";
import type { OutreachChannel } from "@/types/job";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Shield, ChevronDown, Copy, Check, FolderGit2, Trash2, RotateCw, Target } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const MINT = "var(--mint)";
const MINT_DIM = "var(--mint-dim)";
const SURFACE_2 = "var(--surface-2)";
const SURFACE_3 = "var(--surface-3)";
const BORDER_SUBTLE = "var(--border-subtle)";
const BORDER_DEFAULT = "var(--border-default)";
const TEXT_1 = "var(--text-1)";
const TEXT_2 = "var(--text-2)";
const TEXT_3 = "var(--text-3)";

// ─── Helper sub-components ─────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">
			{children}
		</p>
	);
}

function CheckRow({ text }: { text: string }) {
	return (
		<li
			className="flex items-start gap-2 text-sm"
			style={{ color: "var(--text-2)" }}
		>
			<span className="mt-1.5 text-[6px] text-foreground/40 shrink-0">●</span>
			<span className="leading-relaxed font-medium">{text}</span>
		</li>
	);
}

function GapRow({ text }: { text: string }) {
	return (
		<li
			className="flex items-start gap-2 text-[12px] opacity-60"
			style={{ color: "var(--foreground)" }}
		>
			<span className="mt-1 text-[8px] text-foreground/40">○</span>
			<span className="leading-relaxed font-medium">{text}</span>
		</li>
	);
}

// ─── Channel tab config ────────────────────────────────────────────────────────
const CHANNELS: { label: string; value: OutreachChannel; icon: string }[] = [
	{ label: "Email", value: "email", icon: "✉" },
	{ label: "LinkedIn", value: "linkedin", icon: "in" },
	{ label: "Twitter", value: "twitter", icon: "𝕏" },
];

// ─── Main component ────────────────────────────────────────────────────────────
export function JobInsightSheet({
	job,
	open,
	onClose,
}: {
	job: JobPost | null;
	open: boolean;
	onClose: () => void;
}) {
	const router = useRouter();

	// ── Promote / Remove / Redistill states
	const [isPromoting, setIsPromoting] = useState(false);
	const [isRedistilling, setIsRedistilling] = useState(false);
	const [isRemoving, setIsRemoving] = useState(false);

	// ── Multi-channel hook state
	const [channel, setChannel] = useState<OutreachChannel>("email");
	const [hooksByChannel, setHooksByChannel] = useState<
		Partial<Record<OutreachChannel, string>>
	>({});
	const [isGeneratingHook, setIsGeneratingHook] = useState(false);
	const [copiedChannel, setCopiedChannel] = useState<OutreachChannel | null>(
		null
	);

	// ── Shield / objection state
	const [objectionStrategies, setObjectionStrategies] = useState<string[]>([]);
	const [isLoadingObjections, setIsLoadingObjections] = useState(false);
	const [isShieldOpen, setIsShieldOpen] = useState(false);

	// ── Portfolio mapping state
	const [portfolioMapping, setPortfolioMapping] = useState<any[]>([]);
	const [isMappingPortfolio, setIsMappingPortfolio] = useState(false);

	// ── Seed local state from cached DB values when sheet opens / job changes
	useEffect(() => {
		if (!job || !open) return;

		// Seed hooks from cached outreach_hooks
		if (job.outreach_hooks) {
			setHooksByChannel({
				email: job.outreach_hooks.email,
				linkedin: job.outreach_hooks.linkedin,
				twitter: job.outreach_hooks.twitter,
			});
		} else {
			setHooksByChannel({});
		}

		// Seed objection strategies from cache
		if (job.objection_strategies && job.objection_strategies.length > 0) {
			setObjectionStrategies(job.objection_strategies);
		} else {
			setObjectionStrategies([]);
		}

		// Seed portfolio mapping from cache
		if (job.portfolio_mapping && job.portfolio_mapping.length > 0) {
			setPortfolioMapping(job.portfolio_mapping);
		} else {
			setPortfolioMapping([]);
		}

		// Reset UI state on job change
		setChannel("email");
		setIsShieldOpen(false);
	}, [job?.id, open]);

	// Distilled data flags
	const distilled = job?.distilled_data ?? null;
	const isPending = job?.distillation_pending === true && distilled === null;
	const hasDistilledData = distilled !== null;

	const isInsightSalaryUndisclosed = !job?.pay || (!job?.pay?.min && !job?.pay?.max) || (job?.pay?.min === 0 && job?.pay?.max === 0);
	const insightSalaryLabel = isInsightSalaryUndisclosed ? "Undisclosed" : `₹${job?.pay?.min}–${job?.pay?.max}L`;

	// Current hook for the active channel (local state wins over cached)
	const activeHook = hooksByChannel[channel];

	// ─── API: map portfolio assets for target job ──────────────────────────────
	const mapPortfolio = useCallback(async () => {
		if (isMappingPortfolio || !job) return;
		setIsMappingPortfolio(true);

		const toastId = toast.loading("Mapping portfolio assets...");

		try {
			const res = await fetch("/api/job/map-portfolio", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					jobId: job.id,
					jobDescription: job.description,
					requiredTech: job.tech_stack,
				}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Mapping failed");

			setPortfolioMapping(data);

			// Immediately patch Supabase on the frontend (for client caching resilience)
			const isRealJobId =
				typeof job.id === "string" &&
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
					job.id
				);

			if (isRealJobId) {
				const { error: patchError } = await supabase
					.from("jobs")
					.update({
						portfolio_mapping: data,
						updated_at: new Date().toISOString(),
					})
					.eq("id", job.id);

				if (patchError) {
					console.error("Frontend portfolio patch failed:", patchError);
				}
			}

			toast.success("Portfolio projects mapped! 🚀", { id: toastId });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Mapping failed: ${msg}`, { id: toastId });
		} finally {
			setIsMappingPortfolio(false);
		}
	}, [job, isMappingPortfolio]);

	// ─── API: generate hook for a channel ─────────────────────────────────────
	const generateHook = useCallback(
		async (targetChannel: OutreachChannel) => {
			if (isGeneratingHook || !job) return;
			setIsGeneratingHook(true);

			const toastId = toast.loading(
				`Generating ${targetChannel} hook…`
			);

			try {
				const res = await fetch("/api/job/generate-hook", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ job, channel: targetChannel }),
				});

				const data = await res.json();
				if (!res.ok) throw new Error(data.error || "Hook generation failed");

				const newHook = data.hook as string;
				const updatedHooks = {
					...hooksByChannel,
					[targetChannel]: newHook,
				};

				setHooksByChannel(updatedHooks);

				// Immediately patch Supabase on the frontend
				const isRealJobId =
					typeof job.id === "string" &&
					/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
						job.id
					);

				if (isRealJobId) {
					const { error: patchError } = await supabase
						.from("jobs")
						.update({
							outreach_hooks: {
								...(job.outreach_hooks ?? {}),
								...updatedHooks,
							},
							updated_at: new Date().toISOString(),
						})
						.eq("id", job.id);

					if (patchError) {
						console.error("Frontend patch failed:", patchError);
					}
				}

				toast.success("Hook generated", { id: toastId });
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				toast.error(`Failed: ${msg}`, { id: toastId });
			} finally {
				setIsGeneratingHook(false);
			}
		},
		[job, isGeneratingHook, hooksByChannel]
	);

	// ─── API: analyze gaps + generate objection strategies ────────────────────
	const generateShield = useCallback(async () => {
		if (isLoadingObjections || !job) return;
		setIsLoadingObjections(true);
		setIsShieldOpen(true);

		const toastId = toast.loading("Generating Shield strategies…");

		try {
			const res = await fetch("/api/job/analyze-gaps", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ job }),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Analysis failed");

			const strategies: string[] = Array.isArray(data.objection_strategies)
				? data.objection_strategies
				: Array.isArray(data.gaps)
				? data.gaps
				: [];

			setObjectionStrategies(strategies);

			// Immediately patch Supabase on the frontend
			const isRealJobId =
				typeof job.id === "string" &&
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
					job.id
				);

			if (isRealJobId && strategies.length > 0) {
				const { error: patchError } = await supabase
					.from("jobs")
					.update({
						objection_strategies: strategies,
						updated_at: new Date().toISOString(),
					})
					.eq("id", job.id);

				if (patchError) {
					console.error("Frontend shield patch failed:", patchError);
				}
			}

			toast.success("Shield ready", { id: toastId });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Shield failed: ${msg}`, { id: toastId });
		} finally {
			setIsLoadingObjections(false);
		}
	}, [job, isLoadingObjections]);

	// ─── Copy helper ──────────────────────────────────────────────────────────
	const copyHook = async (ch: OutreachChannel) => {
		const text = hooksByChannel[ch];
		if (!text) return;
		await navigator.clipboard.writeText(text);
		setCopiedChannel(ch);
		toast.success(`${ch.charAt(0).toUpperCase() + ch.slice(1)} hook copied!`);
		setTimeout(() => setCopiedChannel(null), 2000);
	};

	// ─── Existing action handlers ─────────────────────────────────────────────
	const handleApply = () => {
		if (!job) return;
		const quickIntro =
			activeHook ||
			`I scored a ${job.match_score}% match for the ${job.role} position at ${job.company.name} and would love to connect.`;
		navigator.clipboard.writeText(quickIntro);
		toast.success("Intro copied!", {
			description: "Paste it directly into your application.",
		});
		window.open(job.apply_url, "_blank");
	};

	const handleRedistill = async () => {
		if (!job) return;
		setIsRedistilling(true);
		const toastId = toast.loading("Re-distilling with AI…");
		try {
			const res = await fetch("/api/scout/distill", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jobId: job.id }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Distillation failed");
			toast.success("Job distilled! Refreshing…", { id: toastId });
			router.refresh();
			onClose();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Distillation failed: ${msg}`, { id: toastId });
		} finally {
			setIsRedistilling(false);
		}
	};

	const promoteJobToSerious = async () => {
		const jobId = job?.id;
		if (!jobId || typeof jobId !== "string" || jobId.trim() === "") {
			toast.error("Cannot promote: Job ID is missing or invalid.", {
				description: "This may be a mock job that was not saved to the database.",
			});
			return;
		}

		setIsPromoting(true);
		const toastId = toast.loading("Moving to Serious Mode...");

		try {
			const res = await fetch("/api/job/update", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jobId, updates: { status: "serious" } }),
			});
			const data = await res.json();

			if (!res.ok) {
				toast.error(
					`[Status: ${res.status}] ${res.statusText} - ${data.error || "Unknown error"}`,
					{ id: toastId }
				);
				return;
			}

			toast.success("Added to your Serious Queue! 🚀", { id: toastId });
			onClose();
			router.push("/dashboard/serious");
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Unexpected error: ${msg}`, { id: toastId });
		} finally {
			setIsPromoting(false);
		}
	};

	const removeJob = async () => {
		const jobId = job?.id;
		if (!jobId || typeof jobId !== "string" || jobId.trim() === "") return;

		setIsRemoving(true);
		const toastId = toast.loading("Removing job...");

		try {
			const res = await fetch("/api/job/update", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jobId, updates: { status: "removed" } }),
			});
			const data = await res.json();

			if (!res.ok) {
				toast.error(`Error: ${data.error || "Unknown error"}`, { id: toastId });
				return;
			}

			toast.success("Job removed", { id: toastId });
			onClose();
			router.refresh();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Unexpected error: ${msg}`, { id: toastId });
		} finally {
			setIsRemoving(false);
		}
	};

	// ─── Render ───────────────────────────────────────────────────────────────
	if (!job) return null;

	return (
		<Sheet open={open} onOpenChange={(v) => !v && onClose()}>
			<SheetContent
				className="flex flex-col outline-none w-[90vw] max-w-[440px] p-0 sm:max-w-[440px]"
				style={{
					background: "var(--surface-0)",
					borderLeft: `1px solid ${BORDER_DEFAULT}`,
				}}
			>
				{/* ── Header ─────────────────────────────────────────────── */}
				<SheetHeader
					className="border-b px-6 py-6 shrink-0 text-left"
					style={{
						borderColor: BORDER_SUBTLE,
						background: "rgba(255,255,255,0.01)",
					}}
				>
					<div>
						<SheetDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-3)]">
							{job.company.name}
						</SheetDescription>
						<SheetTitle className="text-xl font-bold tracking-tight mt-1 text-[var(--text-1)]">
							{job.role}
						</SheetTitle>
						<div className="mt-2 flex items-center gap-3 text-xs font-semibold text-[var(--text-2)]">
							<span>{job.remote_status}</span>
							<span className="text-[var(--text-3)]">•</span>
							<span>{job.location.split(",")[0]}</span>
							<span className="text-[var(--text-3)]">•</span>
							<span className={isInsightSalaryUndisclosed ? "text-[var(--text-3)]" : ""}>
								{insightSalaryLabel}
							</span>
						</div>
					</div>
				</SheetHeader>

				{/* ── Scrollable Body ─────────────────────────────────────── */}
				<div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

					{/* ── Pending distillation banner ──────────────────────── */}
					{isPending && (
						<div
							className="rounded-lg p-4 flex flex-col gap-3"
							style={{
								background: "rgba(251,191,36,0.06)",
								border: "1px solid rgba(251,191,36,0.25)",
							}}
						>
							<div className="flex items-center gap-2">
								<span style={{ color: "#FBBF24" }}>⏳</span>
								<p
									className="text-[11px] font-bold uppercase tracking-widest"
									style={{ color: "#FBBF24" }}
								>
									Pending AI Distillation
								</p>
							</div>
							<p
								className="text-xs leading-relaxed font-medium"
								style={{ color: "#A1A1AA" }}
							>
								The AI hasn&apos;t analysed this job yet. Hit Re-distill to
								extract the full role details now.
							</p>
							<button
								onClick={handleRedistill}
								disabled={isRedistilling}
								className="flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
								style={{
									background: "rgba(251,191,36,0.12)",
									border: "1px solid rgba(251,191,36,0.3)",
									color: "#FBBF24",
								}}
							>
								{isRedistilling ? (
									<><Loader2 size={12} className="animate-spin" /> Distilling…</>
								) : (
									"✨ Re-distill with AI"
								)}
							</button>
						</div>
					)}

					{/* ════════════════════════════════════════════════════════
					    ── OUTREACH HOOKS — Multi-channel section ────────────
					    ════════════════════════════════════════════════════════ */}
					<section>
						<SectionLabel>Outreach Hook</SectionLabel>

						<div
							className="rounded-lg overflow-hidden"
							style={{
								background: "rgba(255,255,255,0.02)",
								border: `1px solid ${BORDER_DEFAULT}`,
							}}
						>
							{/* ── Scout badge + title ────────────────────────── */}
							<div
								className="flex items-center gap-1.5 px-4 pt-4 pb-2"
							>
								<span className="flex h-3 w-fit px-1 items-center justify-center rounded-sm bg-foreground text-[7px] font-black text-background uppercase">
									Scout
								</span>
								<span className="text-[10px] font-black uppercase tracking-widest text-foreground">
									Channel Hook
								</span>
							</div>

							{/* ── Channel tab switcher ──────────────────────── */}
							<div
								className="flex items-center gap-1.5 px-4 pb-3 border-b border-[var(--border-subtle)]"
							>
								{CHANNELS.map((ch) => {
									const isActive = channel === ch.value;
									const hasCached = !!hooksByChannel[ch.value];
									return (
										<button
											key={ch.value}
											onClick={() => setChannel(ch.value)}
											className={`relative flex items-center gap-1.5 font-bold transition-all duration-150 ease-out ${
												isActive
													? "bg-mint-dim text-mint ring-1 ring-mint-strong text-xs px-3 py-1 rounded-md"
													: "text-[var(--text-3)] hover:text-[var(--text-1)] text-xs px-3 py-1"
											}`}
										>
											<span className="text-[9px]">{ch.icon}</span>
											{ch.label}
											{/* Dot indicator when cached */}
											{hasCached && (
												<span
													className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-mint"
												/>
											)}
										</button>
									);
								})}
							</div>

							{/* ── Hook content area ────────────────────────── */}
							<div className="px-4 pb-4 pt-3 min-h-[80px]">
								{activeHook ? (
									<div className="space-y-2">
										<p
											className="text-sm leading-relaxed font-medium"
											style={{ color: TEXT_2 }}
										>
											{activeHook}
										</p>
										<div className="flex items-center gap-2 pt-1">
											<button
												onClick={() => copyHook(channel)}
												className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-md transition-all hover:opacity-80"
												style={{
													background: MINT_DIM,
													color: MINT,
													border: `1px solid rgba(16,185,129,0.2)`,
												}}
											>
												{copiedChannel === channel ? (
													<><Check size={10} /> Copied</>
												) : (
													<><Copy size={10} /> Copy</>
												)}
											</button>
											<button
												onClick={() => generateHook(channel)}
												disabled={isGeneratingHook}
												className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-md transition-all hover:opacity-80 disabled:opacity-40"
												style={{
													background: "rgba(255,255,255,0.04)",
													color: TEXT_3,
													border: `1px solid ${BORDER_DEFAULT}`,
												}}
											>
												{isGeneratingHook ? (
													<><Loader2 size={9} className="animate-spin" /> Generating…</>
												) : (
													"↻ Regenerate"
												)}
											</button>
										</div>
									</div>
								) : (
									<div className="flex flex-col items-center justify-center gap-3 py-4">
										<p
											className="text-[11px] font-medium text-center"
											style={{ color: TEXT_3 }}
										>
											No {channel} hook yet
										</p>
										<button
											onClick={() => generateHook(channel)}
											disabled={isGeneratingHook}
											className="flex items-center gap-2 text-[11px] font-bold px-4 py-2 rounded-md transition-all hover:opacity-90 disabled:opacity-40"
											style={{
												background: MINT_DIM,
												color: MINT,
												border: `1px solid rgba(16,185,129,0.25)`,
											}}
										>
											{isGeneratingHook ? (
												<><Loader2 size={11} className="animate-spin" /> Generating…</>
											) : (
												<>✦ Generate {CHANNELS.find((c) => c.value === channel)?.label} Hook</>
											)}
										</button>
									</div>
								)}
							</div>
						</div>
					</section>

					{/* ════════════════════════════════════════════════════════
					    ── PROOF OF WORK — Relational Projects ───────────
					    ════════════════════════════════════════════════════════ */}
					<section>
						<SectionLabel>Proof of Work</SectionLabel>

						{portfolioMapping && portfolioMapping.length > 0 ? (
							<div
								className="rounded-lg p-4 space-y-4 border border-[var(--border-subtle)] bg-[var(--surface-2)]"
							>
								{portfolioMapping.map((project, i) => (
									<div key={i} className="flex items-start gap-3">
										<FolderGit2
											size={16}
											className="mt-0.5 shrink-0 text-mint"
											strokeWidth={1.5}
										/>
										<div className="space-y-1">
											<h4 className="text-xs font-black text-[var(--text-1)] uppercase tracking-wider">
												{project.project_name}
											</h4>
											<p className="text-sm leading-relaxed text-[var(--text-2)] font-medium">
												{project.justification}
											</p>
										</div>
									</div>
								))}

								<button
									onClick={mapPortfolio}
									disabled={isMappingPortfolio}
									className="mt-2 w-full flex items-center justify-center gap-2 rounded-md py-1.5 text-[10px] font-bold transition-all hover:opacity-80 disabled:opacity-40 border border-[var(--border-subtle)] text-[var(--text-3)] bg-white/5"
								>
									{isMappingPortfolio ? (
										<><Loader2 size={10} className="animate-spin" /> Remapping…</>
									) : (
										"↻ Remap Proof of Work"
									)}
								</button>
							</div>
						) : (
							<div
								className="rounded-lg p-4 flex flex-col items-center justify-center gap-3 border border-[var(--border-subtle)] bg-[var(--surface-2)]"
							>
								<p className="text-xs font-medium text-[var(--text-3)] text-center">
									No portfolio projects mapped yet
								</p>
								<button
									onClick={mapPortfolio}
									disabled={isMappingPortfolio}
									className="bg-mint-dim text-mint text-xs px-3 py-1.5 rounded-md hover:opacity-90 transition-all font-bold border border-mint/20 flex items-center justify-center gap-1.5 w-full"
								>
									{isMappingPortfolio ? (
										<><Loader2 size={12} className="animate-spin text-mint" /> Mapping Proof of Work…</>
									) : (
										<>✦ Map Proof of Work</>
									)}
								</button>
							</div>
						)}
					</section>

					{/* ════════════════════════════════════════════════════════
					    ── THE REALITY CHECK — Skill Gaps & Objection Shield ──
					    ════════════════════════════════════════════════════════ */}
					{hasDistilledData && (
						<section className="space-y-4">
							<SectionLabel>The Reality Check</SectionLabel>
							<div className="rounded-lg p-5 border border-[var(--border-subtle)] bg-[var(--surface-2)] space-y-4">
								{/* Gaps Section */}
								<div className="space-y-2">
									<p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
										Skill Gaps
									</p>
									{distilled.gaps && distilled.gaps.length > 0 ? (
										<ul className="space-y-2">
											{distilled.gaps.map((gap, i) => (
												<li key={i} className="flex items-center gap-2 text-sm text-[var(--text-2)] font-medium">
													<span className="text-red-400 font-bold shrink-0">✕</span>
													<span>{gap}</span>
												</li>
											))}
										</ul>
									) : (
										<p className="text-sm font-semibold text-mint flex items-center gap-1.5">
											<span className="text-mint font-bold shrink-0">✓</span>
											No gaps detected. Alignment is strong.
										</p>
									)}
								</div>

								{/* Shield Objection Handling Block */}
								<div className="rounded-lg p-4 border border-[var(--border-subtle)] bg-[var(--surface-3)] space-y-3">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Shield
												size={14}
												className="text-mint shrink-0"
												strokeWidth={1.5}
											/>
											<span className="text-[10px] font-black uppercase tracking-widest text-mint">
												Objection Handling
											</span>
											{objectionStrategies.length > 0 && (
												<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-mint-dim text-mint">
													{objectionStrategies.length}
												</span>
											)}
										</div>
										{isLoadingObjections && (
											<Loader2 size={12} className="animate-spin text-mint shrink-0" />
										)}
									</div>

									<div className="space-y-3">
										{objectionStrategies.length === 0 && !isLoadingObjections ? (
											<button
												onClick={generateShield}
												disabled={isLoadingObjections}
												className="w-full flex items-center justify-center gap-2 rounded-md py-1.5 text-[10px] font-bold transition-all hover:opacity-80 border border-mint/20 text-mint bg-mint-dim"
											>
												✦ Generate Objection Handler
											</button>
										) : isLoadingObjections ? (
											<div className="flex items-center gap-2 py-2">
												<Loader2
													size={11}
													className="animate-spin text-mint"
												/>
												<span className="text-[var(--text-3)] text-[11px] font-medium">
													Generating counter-arguments…
												</span>
											</div>
										) : (
											<>
												{objectionStrategies.map((strategy, i) => (
													<div key={i} className="flex gap-3 items-start">
														<div
															className="mt-[7px] shrink-0 w-1.5 h-1.5 rounded-full bg-mint shadow-[0_0_8px_var(--mint-strong)]"
														/>
														<p className="text-[var(--text-2)] text-sm leading-relaxed">
															{strategy}
														</p>
													</div>
												))}
												{/* Regenerate button */}
												<button
													onClick={generateShield}
													disabled={isLoadingObjections}
													className="mt-2 w-full flex items-center justify-center gap-2 rounded-md py-1.5 text-[10px] font-bold transition-all hover:opacity-80 disabled:opacity-40 border border-[var(--border-subtle)] text-[var(--text-3)] bg-white/5"
												>
													↻ Regenerate Shield
												</button>
											</>
										)}
									</div>
								</div>
							</div>
						</section>
					)}

					{/* ── Resume Additions ── */}
					{hasDistilledData &&
						distilled.tailored_bullets &&
						distilled.tailored_bullets.length > 0 && (
							<section>
								<SectionLabel>Resume Additions</SectionLabel>
								<ul className="space-y-1.5">
									{distilled.tailored_bullets.map((b, i) => (
										<CheckRow key={i} text={b} />
									))}
								</ul>
							</section>
						)}

					{/* ── Fallback: About the Role (no distilled data) ─────── */}
					{!hasDistilledData && !isPending && (
						<>
							<section>
								<SectionLabel>AI-Distilled Insight</SectionLabel>
								<div
									className="rounded-lg p-5 text-[12px] leading-relaxed font-semibold"
									style={{
										background: "rgba(255,255,255,0.02)",
										border: `1px solid ${BORDER_DEFAULT}`,
										color: "var(--foreground)",
									}}
								>
									<div className="flex items-center gap-1.5 mb-2">
										<span className="flex h-3 w-fit px-1 items-center justify-center rounded-sm bg-foreground text-[7px] font-black text-background uppercase">
											Scout
										</span>
										<span className="text-[10px] font-black uppercase tracking-widest text-foreground">
											Scout
										</span>
									</div>
									<ul
										className="list-disc pl-4 space-y-1 mt-2 font-medium"
										style={{ color: TEXT_2 }}
									>
										<li>
											Strong alignment: {job.tech_stack.slice(0, 2).join(", ")}
										</li>
										<li>
											Salary matches your target range: ₹{job.pay.min}-
											{job.pay.max}L
										</li>
										<li>
											{job.match_score >= 80
												? "Highly recommended to apply immediately."
												: "Moderate match on required experience level."}
										</li>
									</ul>
								</div>
							</section>

							<section>
								<SectionLabel>About the Role</SectionLabel>
								<p
									className="text-sm leading-relaxed font-medium"
									style={{ color: TEXT_2 }}
								>
									{job.description}
								</p>
							</section>

							<section>
								<SectionLabel>Requirements</SectionLabel>
								<ul className="space-y-1.5">
									{job.requirements.map((r, i) => (
										<CheckRow key={i} text={r} />
									))}
								</ul>
							</section>
						</>
					)}
				</div>

				{/* ── Floating Action Bar ─────────────────────────────────── */}
					<div
						className="sticky bottom-0 w-full z-50 bg-[var(--surface-1)]/90 backdrop-blur-md border-t border-[var(--border-subtle)] p-4 sm:p-6 flex justify-between items-center shrink-0"
					>
						{/* Left Side (Destructive/Secondary Actions) */}
						<div className="flex items-center gap-1.5">
							<button
								disabled={isRemoving}
								onClick={removeJob}
								title="Remove Job"
								className="text-[var(--text-3)] hover:text-red-400 hover:bg-[var(--surface-3)] p-2 rounded-md transition-all disabled:opacity-40 cursor-pointer"
							>
								{isRemoving ? (
									<Loader2 size={16} className="animate-spin" />
								) : (
									<Trash2 size={16} strokeWidth={1.5} />
								)}
							</button>
							<button
								disabled={isRedistilling}
								onClick={handleRedistill}
								title="Refresh AI Analysis"
								className="text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-3)] p-2 rounded-md transition-all disabled:opacity-40 cursor-pointer"
							>
								{isRedistilling ? (
									<Loader2 size={16} className="animate-spin" />
								) : (
									<RotateCw size={16} strokeWidth={1.5} />
								)}
							</button>
						</div>

						{/* Right Side (Primary & Secondary CTAs) */}
						<div className="flex items-center gap-2.5">
							<button
								onClick={handleApply}
								className="border border-[var(--border-subtle)] text-[var(--text-1)] px-4 py-2 rounded-md hover:border-[var(--border-strong)] bg-[var(--surface-2)] transition-all text-xs font-semibold whitespace-nowrap cursor-pointer"
							>
								Copy Intro &amp; Apply
							</button>
							<button
								disabled={isPromoting}
								onClick={promoteJobToSerious}
								className="flex items-center gap-1.5 bg-mint text-[#050505] font-semibold px-5 py-2 rounded-md hover:bg-mint-strong transition-all duration-150 transform hover:-translate-y-[1px] shadow-[0_0_15px_var(--mint-dim)] disabled:opacity-40 text-xs font-semibold whitespace-nowrap cursor-pointer"
							>
								{isPromoting ? (
									<Loader2 size={14} className="animate-spin text-[#050505]" />
								) : (
									<Target size={14} strokeWidth={1.5} />
								)}
								<span>{isPromoting ? "Promoting…" : "Promote to Serious"}</span>
							</button>
						</div>
					</div>
			</SheetContent>
		</Sheet>
	);
}
