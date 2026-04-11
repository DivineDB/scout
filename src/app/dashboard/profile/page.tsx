"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import meData from "@/data/me.json";
import { Persona, ExperienceDetail } from "@/types/persona";
import { Loader2, X, Check, Zap, ChevronRight, Settings2Icon } from "lucide-react";
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
      className={`rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden transition-all duration-300 ${
        clickable
          ? "cursor-pointer group hover:border-[rgba(0,255,194,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,255,194,0.08)]"
          : ""
      } ${className}`}
      style={{
        background: "rgba(18,18,18,0.8)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 2px 20px rgba(0,0,0,0.4)",
        backdropFilter: "blur(12px)",
      }}
    >
      {clickable && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,255,194,0.04) 0%, transparent 70%)",
          }}
        />
      )}
      {children}
      {clickable && (
        <div
          className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0 translate-x-1"
        >
          <ChevronRight size={14} style={{ color: "#00FFC2" }} />
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
      style={{ color: "#71717A" }}
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
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none transition-all"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#FAFAFA",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
        }}
        onFocus={(e) => {
          e.target.style.border = "1px solid rgba(0,255,194,0.4)";
          e.target.style.boxShadow = "0 0 0 3px rgba(0,255,194,0.06), inset 0 1px 2px rgba(0,0,0,0.3)";
        }}
        onBlur={(e) => {
          e.target.style.border = "1px solid rgba(255,255,255,0.1)";
          e.target.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.3)";
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
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold group/badge transition-all duration-150"
      style={{
        background: "rgba(0,255,194,0.08)",
        border: "1px solid rgba(0,255,194,0.2)",
        color: "#00FFC2",
      }}
    >
      {skill}
      <button
        onClick={onRemove}
        className="opacity-50 hover:opacity-100 transition-opacity rounded-full"
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
    const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    const newSkills = [...skills];
    for (const p of parts) {
      if (!newSkills.includes(p)) newSkills.push(p);
    }
    onChange(newSkills);
    setInputValue("");
  };

  return (
    <div
      className="rounded-xl p-3 space-y-2"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
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
          placeholder="Add skill, press Enter…"
          className="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none transition-all"
          style={{
            background: "#121212",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#FAFAFA",
          }}
          onFocus={(e) => {
            e.target.style.border = "1px solid rgba(0,255,194,0.35)";
          }}
          onBlur={(e) => {
            e.target.style.border = "1px solid rgba(255,255,255,0.08)";
          }}
        />
        <button
          onClick={() => addSkill(inputValue)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
          style={{ background: "rgba(0,255,194,0.12)", color: "#00FFC2", border: "1px solid rgba(0,255,194,0.2)" }}
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
      className="px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200"
      style={
        active
          ? {
              background: "rgba(0,255,194,0.12)",
              border: "1px solid rgba(0,255,194,0.3)",
              color: "#00FFC2",
            }
          : {
              background: "transparent",
              border: "1px solid transparent",
              color: "#71717A",
            }
      }
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
  const [draftExperience, setDraftExperience] = useState<ExperienceDetail[]>([]);
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

  // Fetch profile override on mount
  useEffect(() => {
    (async () => {
      const authHeader = await getAuthHeader();
      fetch("/api/profile/update", { headers: authHeader })
        .then((r) => r.json())
        .then(({ profile: p }) => {
          if (p) setOverride(p);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
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
            : [])
      );
      setActiveTab(tab);
      setSheetOpen(true);
    },
    [profile, override]
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
        border: "1px solid rgba(0,255,194,0.2)",
        color: "#00FFC2",
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
          border: "1px solid rgba(0,255,194,0.3)",
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
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#00FFC2" }} />
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-auto p-8 relative min-h-screen"
      style={{ background: "#0A0A0A", color: "var(--foreground)" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,255,194,0.04) 0%, transparent 60%)",
        }}
      />

      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <header className="flex items-end justify-between">
          <div>
            <h1
              className="text-3xl font-black tracking-tight"
              style={{ color: "#FAFAFA" }}
            >
              Command Center
            </h1>
            <p className="text-sm font-medium mt-1" style={{ color: "#A1A1AA" }}>
              Click any card to open the Scout Config Hub.
            </p>
          </div>
          <button
            onClick={() => openSheet("identity")}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:opacity-90 active:scale-95"
            style={{
              background: "rgba(0,255,194,0.1)",
              border: "1px solid rgba(0,255,194,0.25)",
              color: "#00FFC2",
            }}
          >
            <Settings2Icon size={15} />
            Configure Scout
          </button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* ── Identity Card ──────────────────────────────────────────────── */}
          <GlassCard clickable onClick={() => openSheet("identity")}>
            <div className="flex items-center gap-4">
              <div
                className="h-14 w-14 shrink-0 rounded-full flex items-center justify-center text-2xl font-black"
                style={{
                  background: "rgba(0,255,194,0.1)",
                  border: "1px solid rgba(0,255,194,0.25)",
                  color: "#00FFC2",
                }}
              >
                {profile.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate" style={{ color: "#FAFAFA" }}>
                  {profile.name}
                </h2>
                <p className="text-xs font-medium" style={{ color: "#A1A1AA" }}>
                  {profile.degree} &apos;{profile.graduation_year.toString().slice(2)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-col">
                <FieldLabel>Location</FieldLabel>
                <span className="text-sm font-medium mt-0.5" style={{ color: "#FAFAFA" }}>
                  {profile.location.city}, {profile.location.state}
                </span>
              </div>
              <div className="flex flex-col">
                <FieldLabel>Contact</FieldLabel>
                <span className="text-sm font-medium mt-0.5 truncate" style={{ color: "#A1A1AA" }}>
                  {profile.contact.email}
                </span>
              </div>
            </div>

            <div
              className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "#00FFC2" }}
            >
              Edit
            </div>
          </GlassCard>

          {/* ── Preferences Card ───────────────────────────────────────────── */}
          <GlassCard className="lg:col-span-2" clickable onClick={() => openSheet("search-logic")}>
            <div className="flex items-center justify-between">
              <h3
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "#71717A" }}
              >
                Search Logic
              </h3>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-lg"
                style={{
                  background: "rgba(0,255,194,0.08)",
                  border: "1px solid rgba(0,255,194,0.15)",
                  color: "#00FFC2",
                }}
              >
                Scout Params
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div className="space-y-1">
                <FieldLabel>Salary Range</FieldLabel>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-black tracking-tight" style={{ color: "#FAFAFA" }}>
                    ₹{profile.preferences.desired_pay_inr_lpa.min}
                  </span>
                  <span className="text-sm font-bold pb-1" style={{ color: "#A1A1AA" }}>
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
                      className="px-2 py-1 rounded-md text-xs font-bold"
                      style={{
                        background: "rgba(59,130,246,0.12)",
                        border: "1px solid rgba(59,130,246,0.25)",
                        color: "#60A5FA",
                      }}
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <FieldLabel>Desired Roles</FieldLabel>
                <p className="text-sm font-medium leading-snug" style={{ color: "#A1A1AA" }}>
                  {profile.preferences.preferred_roles.join(", ")}
                </p>
              </div>
              <div className="space-y-1">
                <FieldLabel>Company Size</FieldLabel>
                <p className="text-sm font-medium" style={{ color: "#A1A1AA" }}>
                  {profile.preferences.preferred_company_size.join(", ")}
                </p>
              </div>
            </div>
          </GlassCard>

          {/* ── Tech Stack Card ───────────────────────────────────────────── */}
          <GlassCard className="lg:col-span-3" clickable onClick={() => openSheet("tech-arsenal")}>
            <div className="flex items-center justify-between mb-2">
              <h3
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "#71717A" }}
              >
                Tech Arsenal
              </h3>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-lg"
                style={{
                  background: "rgba(168,85,247,0.08)",
                  border: "1px solid rgba(168,85,247,0.2)",
                  color: "#C084FC",
                }}
              >
                {Object.values(profile.skills).flat().length} skills indexed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Object.entries(profile.skills).map(([category, skills]) => (
                <div key={category} className="space-y-2">
                  <h4
                    className="text-xs font-bold capitalize pb-2"
                    style={{
                      color: "#FAFAFA",
                      borderBottom: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    {category.replace(/_/g, " ")}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 rounded text-[11px] font-semibold"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#A1A1AA",
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* ── Experience Card ───────────────────────────────────────────── */}
          <GlassCard className="lg:col-span-3">
            <h3
              className="text-[11px] font-bold uppercase tracking-widest mb-2"
              style={{ color: "#71717A" }}
            >
              Experience
            </h3>
            <div
              className="space-y-6 border-l-2 pl-4 ml-2"
              style={{ borderColor: "rgba(255,255,255,0.07)" }}
            >
              {profile.experience_details.map((exp, idx) => (
                <div key={idx} className="relative">
                  <div
                    className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full ring-4 ring-[#121212]"
                    style={{ background: "#00FFC2" }}
                  />
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-2">
                    <h4 className="text-base font-bold" style={{ color: "#FAFAFA" }}>
                      {exp.role}{" "}
                      <span className="font-medium" style={{ color: "#71717A" }}>
                        at {exp.company}
                      </span>
                    </h4>
                    <span
                      className="text-xs font-bold px-2 py-1 rounded-md"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "#A1A1AA",
                      }}
                    >
                      {exp.duration}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {exp.bullets.map((bullet, i) => (
                      <li
                        key={i}
                        className="text-sm font-medium leading-relaxed flex items-start gap-2"
                        style={{ color: "#A1A1AA" }}
                      >
                        <span style={{ color: "#00FFC2" }} className="font-bold mt-0.5">•</span>
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
          className="!w-full sm:!max-w-lg flex flex-col !p-0 !gap-0 !border-l overflow-hidden"
          style={{
            background: "#0A0A0A",
            borderLeft: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "-20px 0 60px rgba(0,0,0,0.7), -1px 0 0 rgba(0,255,194,0.04)",
          }}
        >
          {/* Sheet Header */}
          <div
            className="shrink-0 px-6 pt-6 pb-4 space-y-4"
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(0,255,194,0.02)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: "rgba(0,255,194,0.1)",
                    border: "1px solid rgba(0,255,194,0.2)",
                  }}
                >
                  <Zap size={15} style={{ color: "#00FFC2" }} />
                </div>
                <SheetTitle
                  className="!text-base !font-black !tracking-tight"
                  style={{ color: "#FAFAFA" }}
                >
                  Scout Config Hub
                </SheetTitle>
              </div>
              <button
                onClick={() => setSheetOpen(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition-all hover:opacity-70"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <X size={14} style={{ color: "#71717A" }} />
              </button>
            </div>

            <SheetDescription className="!text-xs !text-[#71717A] !m-0">
              Update your parameters — Scout uses these to rank every match in real-time.
            </SheetDescription>

            {/* Tab Bar */}
            <div className="flex gap-1.5 pt-1">
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

          {/* Tab Content — scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* ── Identity Tab ── */}
            {activeTab === "identity" && (
              <div className="space-y-5">
                <div
                  className="rounded-xl p-4 space-y-4"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-12 w-12 shrink-0 rounded-full flex items-center justify-center text-xl font-black"
                      style={{
                        background: "rgba(0,255,194,0.1)",
                        border: "1px solid rgba(0,255,194,0.25)",
                        color: "#00FFC2",
                      }}
                    >
                      {profile.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "#FAFAFA" }}>
                        {profile.name}
                      </p>
                      <p className="text-xs" style={{ color: "#71717A" }}>
                        {profile.degree} · Class of {profile.graduation_year}
                      </p>
                    </div>
                  </div>
                </div>

                <SheetInput
                  label="City"
                  value={draftCity}
                  onChange={setDraftCity}
                  placeholder="e.g. Bengaluru"
                />
                <SheetInput
                  label="State"
                  value={draftState}
                  onChange={setDraftState}
                  placeholder="e.g. Karnataka"
                />

                <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-5">
                <div
                  className="rounded-xl p-4 space-y-1"
                  style={{
                    background: "rgba(0,255,194,0.03)",
                    border: "1px solid rgba(0,255,194,0.1)",
                  }}
                >
                  <p className="text-[11px] font-bold" style={{ color: "#00FFC2" }}>
                    💡 Scout Tip
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "#71717A" }}>
                    Jobs below your minimum salary are automatically filtered out. Ideal salary
                    influences your match rank.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <SheetInput
                    label="Min Salary (LPA)"
                    type="number"
                    value={draftSalaryMin}
                    onChange={(v) => setDraftSalaryMin(Number(v))}
                    placeholder="8"
                  />
                  <SheetInput
                    label="Ideal Salary (LPA)"
                    type="number"
                    value={draftSalaryIdeal}
                    onChange={(v) => setDraftSalaryIdeal(Number(v))}
                    placeholder="14"
                  />
                </div>

                <div
                  className="rounded-xl p-4 space-y-3"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <FieldLabel>Read-only preferences (from me.json)</FieldLabel>
                  <div className="space-y-2">
                    <div>
                      <FieldLabel>Preferred Roles</FieldLabel>
                      <p className="text-xs mt-0.5 font-medium" style={{ color: "#A1A1AA" }}>
                        {profile.preferences.preferred_roles.join(" · ")}
                      </p>
                    </div>
                    <div>
                      <FieldLabel>Work Type</FieldLabel>
                      <div className="flex gap-1.5 flex-wrap mt-1">
                        {profile.preferences.work_type.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{
                              background: "rgba(59,130,246,0.1)",
                              border: "1px solid rgba(59,130,246,0.2)",
                              color: "#60A5FA",
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Company Size</FieldLabel>
                      <p className="text-xs mt-0.5 font-medium" style={{ color: "#A1A1AA" }}>
                        {profile.preferences.preferred_company_size.join(", ")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tech Arsenal Tab ── */}
            {activeTab === "tech-arsenal" && (
              <div className="space-y-3">
                <div
                  className="rounded-xl p-4 space-y-1"
                  style={{
                    background: "rgba(168,85,247,0.04)",
                    border: "1px solid rgba(168,85,247,0.15)",
                  }}
                >
                  <p className="text-[11px] font-bold" style={{ color: "#C084FC" }}>
                    🎯 Tech Arsenal
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "#71717A" }}>
                    Click <span style={{ color: "#00FFC2" }}>✕</span> on a badge to remove it.
                    Type a skill and press <kbd
                      className="px-1 py-0.5 rounded text-[9px] font-bold"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }}
                    >Enter</kbd> or{" "}
                    <kbd
                      className="px-1 py-0.5 rounded text-[9px] font-bold"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }}
                    >,</kbd>{" "}
                    to add. Paste comma-separated to bulk add.
                  </p>
                </div>

                {Object.entries(draftSkills).map(([category, skills]) => (
                  <SkillCategoryEditor
                    key={category}
                    category={category}
                    skills={skills}
                    onChange={(newSkills) => updateDraftSkillCategory(category, newSkills)}
                  />
                ))}
              </div>
            )}

            {/* ── Career Story Tab ── */}
            {activeTab === "career-story" && (
              <div className="space-y-5">
                <div
                  className="rounded-xl p-4 space-y-1"
                  style={{
                    background: "rgba(0,255,194,0.03)",
                    border: "1px solid rgba(0,255,194,0.1)",
                  }}
                >
                  <p className="text-[11px] font-bold" style={{ color: "#00FFC2" }}>
                    💼 Career Story
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "#71717A" }}>
                    Update your experience details. Bullet points will be morphed dynamically by the AI for each job.
                  </p>
                </div>
                {draftExperience.map((exp, idx) => (
                  <div key={idx} className="space-y-4 p-4 rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
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
                      <SheetInput
                        label="Duration"
                        value={exp.duration}
                        onChange={(v) => {
                          const newExp = [...draftExperience];
                          newExp[idx].duration = v;
                          setDraftExperience(newExp);
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Bullets (One per line)</FieldLabel>
                      <textarea
                        value={exp.bullets.join("\n")}
                        onChange={(e) => {
                          const newExp = [...draftExperience];
                          newExp[idx].bullets = e.target.value.split("\n").filter(b => b.trim());
                          setDraftExperience(newExp);
                        }}
                        rows={4}
                        className="w-full rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none transition-all"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#A1A1AA",
                          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
                        }}
                      />
                    </div>
                    <button
                        onClick={() => {
                          const newExp = draftExperience.filter((_, i) => i !== idx);
                          setDraftExperience(newExp);
                        }}
                        className="text-xs font-bold transition-colors"
                        style={{ color: "#FCA5A5" }}
                      >
                        Remove Experience
                      </button>
                  </div>
                ))}
                
                <button
                  onClick={() => setDraftExperience([...draftExperience, { role: "", company: "", duration: "", bullets: [] }])}
                  className="w-full py-2.5 rounded-lg border border-dashed transition-colors text-sm font-bold"
                  style={{
                    borderColor: "rgba(0,255,194,0.3)",
                    color: "#00FFC2",
                    background: "transparent",
                  }}
                >
                  + Add Role / Project
                </button>
              </div>
            )}
          </div>

          {/* ── Fixed Footer: Update Scout Logic ── */}
          <div
            className="shrink-0 px-6 py-5 space-y-3"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(12px)",
            }}
          >
            <button
              onClick={handleUpdateBrain}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-black tracking-wide transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #00FFC2 0%, #00D4A0 100%)",
                color: "#050505",
                boxShadow: "0 4px 20px rgba(0,255,194,0.25)",
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Syncing with Scout…
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Update Scout Logic
                </>
              )}
            </button>
            <p className="text-center text-[10px] font-medium" style={{ color: "#3F3F46" }}>
              All active job matches will be re-evaluated after update.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
