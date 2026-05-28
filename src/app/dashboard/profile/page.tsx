"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import meData from "@/data/me.json";
import { Persona, ExperienceDetail } from "@/types/persona";
import {
	Loader2,
	X,
	Check,
	Zap,
	ChevronRight,
	Settings2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from "@/components/ui/sheet";

import { mergeProfile, type ProfileOverride } from "@/lib/profile";

type TabId = "identity" | "search-logic" | "tech-arsenal" | "career-story";

// ── Ambient Glass Card ────────────────────────────────────────────────────────
function GlassCard({
	children,
	className = "",
	onClick,
	clickable = false,
}: {
	children: React.ReactNode;
	className?: string;
	onClick?: () => void;
	clickable?: boolean;
}) {
	return (
		<div
			onClick={onClick}
			className={`obsidian-card p-6 flex flex-col gap-4 relative overflow-hidden transition-all duration-300 ${
				clickable
					? "cursor-pointer group hover:border-[rgba(255,255,255,0.15)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)]"
					: ""
			} ${className}`}
		>
			{clickable && (
				<div
					className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
					style={{
						background:
							"radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,0.02) 0%, transparent 70%)",
					}}
				/>
			)}
			{children}
			{clickable && (
				<div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0 translate-x-1">
					<ChevronRight size={14} className="text-accent" />
				</div>
			)}
		</div>
	);
}

// ── Field label ───────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
	return (
		<span
			className="text-[10px] font-bold uppercase tracking-widest"
			style={{ color: "var(--text-3)" }}
		>
			{children}
		</span>
	);
}

// ── Sheet Input ───────────────────────────────────────────────────────────────
function SheetInput({
	label,
	value,
	onChange,
	type = "text",
	placeholder,
}: {
	label: string;
	value: string | number;
	onChange: (v: string) => void;
	type?: string;
	placeholder?: string;
}) {
	return (
		<div className="space-y-2">
			<FieldLabel>{label}</FieldLabel>
			<input
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="w-full rounded-xl px-4 py-3 text-sm font-medium focus:outline-none transition-all surface-3 border border-subtle focus:border-strong text-text-1"
				style={{
					boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
				}}
			/>
		</div>
	);
}

// ── Skill Badge ───────────────────────────────────────────────────────────────
function SkillBadge({
	skill,
	onRemove,
}: {
	skill: string;
	onRemove: () => void;
}) {
	return (
		<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-150 bg-mint-dim text-mint border border-mint/10">
			{skill}
			<button
				onClick={onRemove}
				className="opacity-40 hover:opacity-100 transition-opacity"
				title={`Remove ${skill}`}
			>
				<X size={10} />
			</button>
		</span>
	);
}

// ── Skill Category Editor ─────────────────────────────────────────────────────
function SkillCategoryEditor({
	category,
	skills,
	onChange,
}: {
	category: string;
	skills: string[];
	onChange: (newSkills: string[]) => void;
}) {
	const [inputValue, setInputValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const addSkill = (raw: string) => {
		const trimmed = raw.trim();
		if (!trimmed) return;
		// Support comma-separated paste
		const parts = trimmed
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		const newSkills = [...skills];
		for (const p of parts) {
			if (!newSkills.includes(p)) newSkills.push(p);
		}
		onChange(newSkills);
		setInputValue("");
	};

	return (
		<div className="rounded-xl p-4 space-y-3 surface-2 border border-subtle">
			<FieldLabel>{category.replace(/_/g, " ")}</FieldLabel>
			<div className="flex flex-wrap gap-1.5 min-h-[28px]">
				{skills.map((skill) => (
					<SkillBadge
						key={skill}
						skill={skill}
						onRemove={() => onChange(skills.filter((s) => s !== skill))}
					/>
				))}
			</div>
			<div className="flex gap-2">
				<input
					ref={inputRef}
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === ",") {
							e.preventDefault();
							addSkill(inputValue);
						}
					}}
					placeholder="Add skill…"
					className="flex-1 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none transition-all surface-3 border border-subtle text-text-1 focus:border-strong"
				/>
				<button
					onClick={() => addSkill(inputValue)}
					className="px-3 py-2 rounded-lg text-xs font-bold transition-all hover:bg-surface-4 border border-subtle text-text-1"
				>
					<Check size={12} />
				</button>
			</div>
		</div>
	);
}

// ── Tab Button (inside sheet) ─────────────────────────────────────────────────
function TabButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			onClick={onClick}
			className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 border ${
				active
					? "bg-white/5 border-white/10 text-text-1"
					: "bg-transparent border-transparent text-text-3 hover:text-text-1"
			}`}
		>
			{children}
		</button>
	);
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
	const router = useRouter();
	const base = meData as Persona;

	const [override, setOverride] = useState<ProfileOverride | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [activeTab, setActiveTab] = useState<TabId>("identity");
	const [isSaving, setIsSaving] = useState(false);

	// Draft values (unified — all edits happen inside the sheet)
	const [draftCity, setDraftCity] = useState("");
	const [draftState, setDraftState] = useState("");
	const [draftSalaryMin, setDraftSalaryMin] = useState<number>(0);
	const [draftSalaryIdeal, setDraftSalaryIdeal] = useState<number>(0);
	const [draftSkills, setDraftSkills] = useState<Record<string, string[]>>({});
	const [draftExperience, setDraftExperience] = useState<ExperienceDetail[]>(
		[],
	);
	const [draftEmail, setDraftEmail] = useState("");
	const [draftPhone, setDraftPhone] = useState("");

	/** Get a fresh Bearer token from the shared anon-key Supabase client */
	const getAuthHeader = async (): Promise<Record<string, string>> => {
		try {
			const { data } = await supabase.auth.getSession();
			const token = data?.session?.access_token;
			if (token) return { Authorization: `Bearer ${token}` };
		} catch {}
		return {};
	};

	const profile = mergeProfile(base, override);

	const hasFetched = useRef(false);
	useEffect(() => {
		if (hasFetched.current) return;
		hasFetched.current = true;

		(async () => {
			const authHeader = await getAuthHeader();
			fetch("/api/profile/update", { headers: authHeader })
				.then((r) => r.json())
				.then(({ profile: p }) => {
					if (p) setOverride(p);
				})
				.catch(console.error)
				.finally(() => {
					setIsLoading(false);
				});
		})();

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Seed draft state from current profile whenever sheet opens
	const openSheet = useCallback(
		(tab: TabId = "identity") => {
			setDraftCity(profile.location.city);
			setDraftState(profile.location.state);
			setDraftSalaryMin(profile.preferences.desired_pay_inr_lpa.min);
			setDraftSalaryIdeal(profile.preferences.desired_pay_inr_lpa.ideal);
			setDraftEmail(override?.contact_email ?? profile.contact.email ?? "");
			setDraftPhone(override?.contact_phone ?? profile.contact.phone ?? "");
			// Deep-clone skills
			const cloned: Record<string, string[]> = {};
			for (const [cat, arr] of Object.entries(profile.skills)) {
				cloned[cat] = [...arr];
			}
			setDraftSkills(cloned);
			setDraftExperience(
				override?.experience_details ??
					(profile.experience_details
						? profile.experience_details.map((e) => ({
								...e,
								bullets: [...e.bullets],
							}))
						: []),
			);
			setActiveTab(tab);
			setSheetOpen(true);
		},
		[profile, override],
	);

	const updateDraftSkillCategory = (category: string, newSkills: string[]) => {
		setDraftSkills((prev) => ({ ...prev, [category]: newSkills }));
	};

	// Update Scout Brain
	const handleUpdateBrain = async () => {
		setIsSaving(true);

		const toastId = toast.loading("Syncing your profile with Scout…", {
			style: {
				background: "#0A0A0A",
				border: "1px solid var(--accent-strong)",
				color: "var(--accent-color)",
			},
		});

		try {
			const authHeader = await getAuthHeader();

			const body: ProfileOverride = {
				city: draftCity,
				state: draftState,
				salary_min: Number(draftSalaryMin),
				salary_ideal: Number(draftSalaryIdeal),
				skills: draftSkills,
				contact_email: draftEmail,
				contact_phone: draftPhone,
				experience_details: draftExperience,
			};

			const res = await fetch("/api/profile/update", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader },
				body: JSON.stringify(body),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || "Update failed");
			}

			// Sync local override
			if (data.profile) {
				setOverride({
					city: data.profile.city,
					state: data.profile.state,
					salary_min: data.profile.salary_min,
					salary_ideal: data.profile.salary_ideal,
					skills: data.profile.skills,
					contact_email: data.profile.contact_email,
					contact_phone: data.profile.contact_phone,
					experience_details: data.profile.experience_details,
				});
			} else {
				setOverride(body);
			}

			toast.success("Scout logic updated. Matches re-evaluating…", {
				id: toastId,
				style: {
					background: "#0A0A0A",
					border: "1px solid var(--accent-strong)",
					color: "#FAFAFA",
				},
			});

			setSheetOpen(false);
			router.refresh();
		} catch (err: any) {
			toast.error(`Update failed: ${err.message}`, {
				id: toastId,
				style: {
					background: "#0A0A0A",
					border: "1px solid rgba(239,68,68,0.3)",
					color: "#FCA5A5",
				},
			});
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center p-8">
				<Loader2
					className="h-6 w-6 animate-spin"
					style={{ color: "var(--accent-color)" }}
				/>
			</div>
		);
	}

	return (
		<div
			className="flex-1 overflow-auto p-8 relative min-h-screen"
			style={{ background: "var(--surface-0)", color: "var(--foreground)" }}
		>
			{/* Ambient glow */}
			<div
				className="pointer-events-none fixed inset-0 -z-10"
				style={{
					background:
						"radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,255,255,0.02) 0%, transparent 60%)",
				}}
			/>

			<div className="mx-auto max-w-5xl space-y-8">
				{/* Header */}
				<header className="flex items-end justify-between">
					<div>
						<h1
							className="text-2xl font-black tracking-tight"
							style={{ color: "var(--text-1)" }}
						>
							Command Center
						</h1>
						<p
							className="text-xs font-medium mt-0.5"
							style={{ color: "var(--text-3)" }}
						>
							Bento Logic v1.0 — Syncing Profile Metrics
						</p>
					</div>
					<button
						onClick={() => openSheet("identity")}
						className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:opacity-90 active:scale-95"
						style={{
							background: "var(--accent-dim)",
							border: "1px solid var(--accent-strong)",
							color: "var(--accent-color)",
						}}
					>
						<Settings2Icon size={15} />
						Configure Scout
					</button>
				</header>

				<section className="grid grid-cols-1 md:grid-cols-3 gap-6">
					{/* ── Identity Card (Vertical Span) ─────────────────────────────── */}
					<GlassCard
						className="md:row-span-2 h-full"
						clickable
						onClick={() => openSheet("identity")}
					>
						<div className="flex flex-col gap-6 h-full">
							<div className="flex items-center gap-4">
								<div
									className="h-16 w-16 shrink-0 rounded-full flex items-center justify-center text-2xl font-black"
									style={{
										background: "var(--accent-dim)",
										border: "1px solid var(--accent-strong)",
										color: "var(--accent-color)",
									}}
								>
									{profile.name
										.split(" ")
										.map((n) => n[0])
										.join("")}
								</div>
								<div className="min-w-0">
									<h2
										className="text-xl font-black tracking-tight"
										style={{ color: "var(--text-1)" }}
									>
										{profile.name}
									</h2>
									<p
										className="text-[10px] uppercase font-bold tracking-widest opacity-60"
										style={{ color: "var(--text-2)" }}
									>
										{profile.degree} &apos;
										{profile.graduation_year.toString().slice(2)}
									</p>
								</div>
							</div>

							<div className="space-y-4 flex-1">
								<div className="flex flex-col">
									<FieldLabel>Location</FieldLabel>
									<span
										className="text-sm font-medium mt-0.5"
										style={{ color: "var(--text-1)" }}
									>
										{profile.location.city}, {profile.location.state}
									</span>
								</div>
								<div className="flex flex-col">
									<FieldLabel>Contact</FieldLabel>
									<span
										className="text-sm font-medium mt-0.5 truncate"
										style={{ color: "var(--text-2)" }}
									>
										{profile.contact.email}
									</span>
								</div>
								<div className="flex flex-col">
									<FieldLabel>Experience</FieldLabel>
									<span
										className="text-sm font-medium mt-0.5"
										style={{ color: "var(--text-1)" }}
									>
										2+ Years in Design Engineering
									</span>
								</div>
							</div>

							<div
								className="text-[10px] font-bold uppercase tracking-widest opacity-40"
								style={{ color: "var(--foreground)" }}
							>
								Identity Profile
							</div>
						</div>
					</GlassCard>

					{/* ── Preferences Card (Horizontal Span) ────────────────────────── */}
					<GlassCard
						className="md:col-span-2"
						clickable
						onClick={() => openSheet("search-logic")}
					>
						<div className="flex items-center justify-between">
							<h3
								className="text-[11px] font-bold uppercase tracking-widest"
								style={{ color: "var(--text-3)" }}
							>
								Search Logic
							</h3>
							<span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-accent-dim text-accent border border-subtle">
								Scout Config Ready
							</span>
						</div>

						<div className="grid grid-cols-2 gap-x-8 gap-y-4">
							<div className="space-y-1">
								<FieldLabel>Salary Range</FieldLabel>
								<div className="flex items-end gap-1">
									<span
										className="text-2xl font-black tracking-tight"
										style={{ color: "var(--text-1)" }}
									>
										₹{profile.preferences.desired_pay_inr_lpa.min}
									</span>
									<span
										className="text-sm font-bold pb-1"
										style={{ color: "var(--text-3)" }}
									>
										– {profile.preferences.desired_pay_inr_lpa.ideal} LPA
									</span>
								</div>
							</div>
							<div className="space-y-1">
								<FieldLabel>Work Type</FieldLabel>
								<div className="flex gap-2 flex-wrap mt-1">
									{profile.preferences.work_type.map((type) => (
										<span
											key={type}
											className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-subtle"
											style={{
												background: "var(--surface-3)",
												color: "var(--text-2)",
											}}
										>
											{type}
										</span>
									))}
								</div>
							</div>
							<div className="space-y-1">
								<FieldLabel>Roles</FieldLabel>
								<p
									className="text-sm font-medium leading-snug truncate"
									style={{ color: "var(--text-2)" }}
								>
									{profile.preferences.preferred_roles.join(", ")}
								</p>
							</div>
							<div className="space-y-1">
								<FieldLabel>Company Size</FieldLabel>
								<p
									className="text-sm font-medium"
									style={{ color: "var(--text-2)" }}
								>
									{profile.preferences.preferred_company_size.join(", ")}
								</p>
							</div>
						</div>
					</GlassCard>

					{/* ── Tech Stack Card (Horizontal Span) ─────────────────────────── */}
					<GlassCard
						className="md:col-span-2"
						clickable
						onClick={() => openSheet("tech-arsenal")}
					>
						<div className="flex items-center justify-between mb-4">
							<h3
								className="text-[11px] font-bold uppercase tracking-widest"
								style={{ color: "var(--text-3)" }}
							>
								Tech Arsenal
							</h3>
							<span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-mint-dim text-mint border border-mint/20">
								{Object.values(profile.skills).flat().length} Skillpoints
							</span>
						</div>

						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{Object.entries(profile.skills).map(([category, skills]) => (
								<div key={category} className="space-y-2">
									<h4 className="text-[10px] font-bold uppercase tracking-widest text-[#52525B]">
										{category.replace(/_/g, " ")}
									</h4>
									<div className="flex flex-wrap gap-1.5">
										{skills.map((skill) => {
											const isCore = [
												"Next.js",
												"Figma",
												"Groq",
												"TypeScript",
											].includes(skill);
											const isBasic = ["Git", "HTML", "CSS"].includes(skill);

											if (isCore) {
												return (
													<span
														key={skill}
														className="px-2 py-0.5 rounded text-[10px] font-bold bg-mint-dim text-mint border border-mint/20"
													>
														{skill}
													</span>
												);
											}
											if (isBasic) {
												return (
													<span
														key={skill}
														className="px-2 py-0.5 rounded text-[10px] font-bold border border-subtle bg-transparent"
														style={{ color: "var(--text-2)" }}
													>
														{skill}
													</span>
												);
											}
											return (
												<span
													key={skill}
													className="px-2 py-0.5 rounded text-[10px] font-bold border border-subtle bg-[var(--surface-3)]"
													style={{ color: "var(--text-3)" }}
												>
													{skill}
												</span>
											);
										})}
									</div>
								</div>
							))}
						</div>
					</GlassCard>

					{/* ── Experience Card (Full Width) ──────────────────────────────── */}
					<GlassCard className="md:col-span-3">
						<h3
							className="text-[11px] font-bold uppercase tracking-widest mb-6"
							style={{ color: "var(--text-3)" }}
						>
							Professional Timeline
						</h3>
						<div className="grid md:grid-cols-2 gap-8 relative">
							{/* Minimal vertical line for connecting timeline items */}
							<div className="absolute left-[7px] top-2 bottom-2 w-px bg-border-subtle hidden md:block" />

							{profile.experience_details.map((exp, idx) => (
								<div key={idx} className="relative pl-6">
									<div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-accent" />
									<div className="flex flex-col gap-1 mb-3">
										<h4
											className="text-sm font-black tracking-tight"
											style={{ color: "var(--text-1)" }}
										>
											{exp.role}
										</h4>
										<div className="flex items-center gap-2">
											<span
												className="text-xs font-bold"
												style={{ color: "var(--text-2)" }}
											>
												{exp.company}
											</span>
											<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-3 text-text-3 opacity-60">
												{exp.duration}
											</span>
										</div>
									</div>
									<ul className="space-y-2">
										{exp.bullets.slice(0, 3).map((bullet, i) => (
											<li
												key={i}
												className="text-xs font-medium leading-relaxed flex items-start gap-2"
												style={{ color: "var(--text-3)" }}
											>
												<span className="text-text-1 mt-0.5 opacity-30">—</span>
												<span>{bullet}</span>
											</li>
										))}
									</ul>
								</div>
							))}
						</div>
					</GlassCard>
				</section>
			</div>

			{/* ── Scout Config Hub Sheet ────────────────────────────────────────────── */}
			<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
				<SheetContent
					side="right"
					showCloseButton={false}
					className="!w-full sm:!max-w-xl flex flex-col !p-0 !gap-0 !border-l overflow-hidden surface-0 border-default shadow-2xl"
				>
					<div className="shrink-0 px-8 pt-8 pb-6 space-y-6 border-b border-subtle">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="h-10 w-10 rounded-xl flex items-center justify-center surface-2 border border-subtle">
									<Zap size={18} className="text-mint" />
								</div>
								<div>
									<SheetTitle className="!text-lg !font-black !tracking-tight text-text-1">
										Scout Config Hub
									</SheetTitle>
									<SheetDescription className="!text-[11px] !text-text-3 !m-0 font-medium">
										Bento v1.0 • Tuning Search Logic
									</SheetDescription>
								</div>
							</div>
							<button
								onClick={() => setSheetOpen(false)}
								className="h-9 w-9 rounded-xl flex items-center justify-center transition-all surface-2 border border-subtle hover:border-strong group"
							>
								<X size={16} className="text-text-3 group-hover:text-text-1" />
							</button>
						</div>

						{/* Tab Bar */}
						<div className="flex gap-1.5 p-1 surface-1 rounded-xl border border-subtle w-fit">
							{(
								[
									{ id: "identity", label: "Identity" },
									{ id: "search-logic", label: "Search Logic" },
									{ id: "tech-arsenal", label: "Tech Arsenal" },
									{ id: "career-story", label: "Experience" },
								] as { id: TabId; label: string }[]
							).map((tab) => (
								<TabButton
									key={tab.id}
									active={activeTab === tab.id}
									onClick={() => setActiveTab(tab.id)}
								>
									{tab.label}
								</TabButton>
							))}
						</div>
					</div>

					<div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
						{/* ── Identity Tab ── */}
						{activeTab === "identity" && (
							<div className="space-y-6">
								<div className="rounded-2xl p-6 space-y-4 surface-2 border border-subtle">
									<div className="flex items-center gap-4">
										<div className="h-14 w-14 shrink-0 rounded-full flex items-center justify-center text-xl font-black bg-mint-dim text-mint border border-mint/20">
											{profile.name
												.split(" ")
												.map((n) => n[0])
												.join("")}
										</div>
										<div>
											<p className="text-base font-black tracking-tight text-text-1">
												{profile.name}
											</p>
											<p className="text-xs font-medium text-text-3">
												{profile.degree} · Class of {profile.graduation_year}
											</p>
										</div>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-6">
									<SheetInput
										label="City"
										value={draftCity}
										onChange={setDraftCity}
										placeholder="e.g. Pune"
									/>
									<SheetInput
										label="State"
										value={draftState}
										onChange={setDraftState}
										placeholder="e.g. MH"
									/>
								</div>

								<div className="grid grid-cols-1 gap-6">
									<SheetInput
										label="Contact Email"
										type="email"
										value={draftEmail}
										onChange={setDraftEmail}
										placeholder="you@example.com"
									/>
									<SheetInput
										label="Phone"
										type="tel"
										value={draftPhone}
										onChange={setDraftPhone}
										placeholder="+91 99999 99999"
									/>
								</div>
							</div>
						)}

						{/* ── Search Logic Tab ── */}
						{activeTab === "search-logic" && (
							<div className="space-y-6">
								<div className="rounded-2xl p-5 space-y-2 bg-mint-dim/30 border border-mint/10">
									<p className="text-[11px] font-black uppercase tracking-widest text-mint flex items-center gap-2">
										<Zap size={12} /> Scout Tip
									</p>
									<p className="text-xs leading-relaxed text-text-2">
										Jobs below your minimum salary are automatically filtered.
										Ideal salary influences your match rank.
									</p>
								</div>

								<div className="grid grid-cols-2 gap-6">
									<SheetInput
										label="Min Salary (LPA)"
										type="number"
										value={draftSalaryMin}
										onChange={(v) => setDraftSalaryMin(Number(v))}
										placeholder="6"
									/>
									<SheetInput
										label="Ideal Salary (LPA)"
										type="number"
										value={draftSalaryIdeal}
										onChange={(v) => setDraftSalaryIdeal(Number(v))}
										placeholder="12"
									/>
								</div>

								<div className="rounded-2xl p-6 space-y-6 surface-2 border border-subtle">
									<FieldLabel>Immutable Logic Prefs</FieldLabel>
									<div className="space-y-4">
										<div>
											<FieldLabel>Preferred Roles</FieldLabel>
											<div className="flex gap-2 flex-wrap mt-2">
												{profile.preferences.preferred_roles.map((r) => (
													<span
														key={r}
														className="px-2 py-1 rounded-md text-[10px] font-bold surface-3 border border-subtle text-text-2"
													>
														{r}
													</span>
												))}
											</div>
										</div>
										<div>
											<FieldLabel>Work Mode</FieldLabel>
											<div className="flex gap-2 flex-wrap mt-2">
												{profile.preferences.work_type.map((t) => (
													<span
														key={t}
														className="px-2 py-1 rounded-md text-[10px] font-bold bg-mint-dim text-mint border border-mint/20"
													>
														{t}
													</span>
												))}
											</div>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* ── Tech Arsenal Tab ── */}
						{activeTab === "tech-arsenal" && (
							<div className="space-y-4">
								<div className="rounded-2xl p-5 space-y-2 bg-purple-500/5 border border-purple-500/10 mb-2">
									<p className="text-[11px] font-black uppercase tracking-widest text-purple-400">
										🎯 Knowledge Base
									</p>
									<p className="text-xs leading-relaxed text-text-3">
										Add or remove skills to calibrate Scout's relevance engine.
										Paste comma-separated values for bulk import.
									</p>
								</div>

								{Object.entries(draftSkills).map(([category, skills]) => (
									<SkillCategoryEditor
										key={category}
										category={category}
										skills={skills}
										onChange={(newSkills) =>
											updateDraftSkillCategory(category, newSkills)
										}
									/>
								))}
							</div>
						)}

						{/* ── Career Story Tab ── */}
						{activeTab === "career-story" && (
							<div className="space-y-6">
								<div className="rounded-2xl p-5 space-y-2 bg-blue-500/5 border border-blue-500/10">
									<p className="text-[11px] font-black uppercase tracking-widest text-blue-400">
										💼 Professional Narrative
									</p>
									<p className="text-xs leading-relaxed text-text-3">
										Update your experience details. Scout's AI will dynamcially
										map these bullets to specific job requirements.
									</p>
								</div>

								{draftExperience.map((exp, idx) => (
									<div
										key={idx}
										className="space-y-5 p-6 rounded-2xl surface-2 border border-subtle relative"
									>
										<div className="grid grid-cols-2 gap-4">
											<SheetInput
												label="Role"
												value={exp.role}
												onChange={(v) => {
													const newExp = [...draftExperience];
													newExp[idx].role = v;
													setDraftExperience(newExp);
												}}
											/>
											<SheetInput
												label="Company"
												value={exp.company}
												onChange={(v) => {
													const newExp = [...draftExperience];
													newExp[idx].company = v;
													setDraftExperience(newExp);
												}}
											/>
										</div>
										<SheetInput
											label="Duration"
											value={exp.duration}
											onChange={(v) => {
												const newExp = [...draftExperience];
												newExp[idx].duration = v;
												setDraftExperience(newExp);
											}}
										/>
										<div className="space-y-2">
											<FieldLabel>Bullet Points</FieldLabel>
											<textarea
												value={exp.bullets.join("\n")}
												onChange={(e) => {
													const newExp = [...draftExperience];
													newExp[idx].bullets = e.target.value
														.split("\n")
														.filter((b) => b.trim());
													setDraftExperience(newExp);
												}}
												rows={4}
												className="w-full rounded-xl px-4 py-3 text-sm font-medium focus:outline-none transition-all surface-3 border border-subtle focus:border-strong text-text-2"
												placeholder="Implemented high-fidelity designs..."
											/>
										</div>
										<button
											onClick={() => {
												const newExp = draftExperience.filter(
													(_, i) => i !== idx,
												);
												setDraftExperience(newExp);
											}}
											className="text-[10px] font-black uppercase tracking-widest text-red-500/60 hover:text-red-500 transition-colors"
										>
											Delete Record
										</button>
									</div>
								))}

								<button
									onClick={() =>
										setDraftExperience([
											...draftExperience,
											{ role: "", company: "", duration: "", bullets: [] },
										])
									}
									className="w-full py-4 rounded-xl border border-dashed border-mint/30 text-mint bg-mint-dim/10 hover:bg-mint-dim/20 transition-all text-[11px] font-black uppercase tracking-widest"
								>
									+ Add Narrative Node
								</button>
							</div>
						)}
					</div>

					{/* ── Fixed Footer: Update Scout Logic ── */}
					<div className="shrink-0 px-8 py-6 space-y-4 surface-1 border-t border-subtle">
						<button
							onClick={handleUpdateBrain}
							disabled={isSaving}
							className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-sm font-black tracking-tight transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-mint text-surface-0 shadow-[0_8px_30px_rgba(16,185,129,0.15)]"
						>
							{isSaving ? (
								<>
									<Loader2 size={18} className="animate-spin" />
									Syncing Profile Metrics…
								</>
							) : (
								<>
									<Zap size={18} />
									Save Scout Logic
								</>
							)}
						</button>
						<p className="text-center text-[10px] font-bold uppercase tracking-widest text-text-4">
							Parameters will take effect across all active match-engines
						</p>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}
