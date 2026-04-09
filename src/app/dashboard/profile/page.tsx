"use client";

import React, { useEffect, useState, useCallback } from "react";
import meData from "@/data/me.json";
import { Persona } from "@/types/persona";
import { Loader2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────────────
interface ProfileOverride {
  city?: string;
  state?: string;
  salary_min?: number;
  salary_ideal?: number;
  skills?: Record<string, string[]>;
}

// ── Helper ───────────────────────────────────────────────────────────────────
function mergeProfile(base: Persona, override: ProfileOverride | null): Persona {
  if (!override) return base;
  return {
    ...base,
    location: {
      ...base.location,
      city: override.city ?? base.location.city,
      state: override.state ?? base.location.state,
    },
    preferences: {
      ...base.preferences,
      desired_pay_inr_lpa: {
        min: override.salary_min ?? base.preferences.desired_pay_inr_lpa.min,
        ideal: override.salary_ideal ?? base.preferences.desired_pay_inr_lpa.ideal,
      },
    },
    skills: (override.skills as Persona["skills"]) ?? base.skills,
  };
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-6 flex flex-col gap-4 ${className}`}
      style={{
        background: "var(--card)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.35)",
      }}
    >
      {children}
    </div>
  );
}

// ── Field label ──────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-widest"
      style={{ color: "var(--muted-foreground)" }}
    >
      {children}
    </span>
  );
}

// ── Edit input ───────────────────────────────────────────────────────────────
function EditInput({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 transition-all"
      style={{
        background: "#1A1A1A",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "var(--foreground)",
        "--tw-ring-color": "#00FFC2",
      } as React.CSSProperties}
    />
  );
}


// ── Main page ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const base = meData as Persona;

  // Load profile override from Supabase
  const [override, setOverride] = useState<ProfileOverride | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Active section edit states
  const [editingSection, setEditingSection] = useState<
    "identity" | "preferences" | "skills" | null
  >(null);

  // Draft values (local edit state)
  const [draftCity, setDraftCity] = useState("");
  const [draftState, setDraftState] = useState("");
  const [draftSalaryMin, setDraftSalaryMin] = useState<number>(0);
  const [draftSalaryIdeal, setDraftSalaryIdeal] = useState<number>(0);
  const [draftSkills, setDraftSkills] = useState<Record<string, string>>({}); // comma-separated per category
  const [isSaving, setIsSaving] = useState(false);

  // Merged resolved profile
  const profile = mergeProfile(base, override);

  // Fetch profile override on mount
  useEffect(() => {
    fetch("/api/profile/update")
      .then((r) => r.json())
      .then(({ profile: p }) => {
        if (p) setOverride(p);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // Start editing a section
  const startEdit = useCallback(
    (section: "identity" | "preferences" | "skills") => {
      setEditingSection(section);
      setDraftCity(profile.location.city);
      setDraftState(profile.location.state);
      setDraftSalaryMin(profile.preferences.desired_pay_inr_lpa.min);
      setDraftSalaryIdeal(profile.preferences.desired_pay_inr_lpa.ideal);

      const skillDraft: Record<string, string> = {};
      for (const [cat, arr] of Object.entries(profile.skills)) {
        skillDraft[cat] = arr.join(", ");
      }
      setDraftSkills(skillDraft);
    },
    [profile]
  );

  const cancelEdit = () => setEditingSection(null);

  // Save changes to Supabase via toast.promise for instant feedback
  const saveSection = async () => {
    setIsSaving(true);
    try {
      const parsedSkills: Record<string, string[]> = {};
      for (const [cat, csv] of Object.entries(draftSkills)) {
        parsedSkills[cat] = csv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const body: ProfileOverride = {
        city: draftCity,
        state: draftState,
        salary_min: Number(draftSalaryMin),
        salary_ideal: Number(draftSalaryIdeal),
        skills: parsedSkills,
      };

      console.log("Saving Data:", body);

      await toast.promise(
        fetch("/api/profile/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(async (res) => {
          const data = await res.json();
          console.log("Server Response:", data);
          if (!res.ok) throw new Error(data.error || "Save failed");
          // Sync local state from server response (source of truth)
          if (data.profile) {
            setOverride({
              city: data.profile.city,
              state: data.profile.state,
              salary_min: data.profile.salary_min,
              salary_ideal: data.profile.salary_ideal,
              skills: data.profile.skills,
            });
          } else {
            // Fallback: use draft body if server didn't return profile
            setOverride(body);
          }
          setEditingSection(null);
          router.refresh();
          return data;
        }),
        {
          loading: "Saving changes...",
          success: "Profile updated! Jobs flagged for re-validation.",
          error: (err) => `Failed to save: ${err.message}`,
        }
      );
    } catch (err) {
      console.error("Error saving profile:", err);
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
      style={{ background: "#050505", color: "var(--foreground)" }}
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
        <header>
          <h1
            className="text-3xl font-black tracking-tight"
            style={{ color: "#FAFAFA" }}
          >
            Command Center
          </h1>
          <p className="text-sm font-medium mt-1" style={{ color: "#A1A1AA" }}>
            Your profile data — Scout uses this to score every match.
          </p>
        </header>


        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* ── Identity Card ─────────────────────────────────────────────── */}
          <SectionCard>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="h-14 w-14 rounded-full flex items-center justify-center text-2xl font-black"
                  style={{
                    background: "rgba(0,255,194,0.1)",
                    border: "1px solid rgba(0,255,194,0.25)",
                    color: "#00FFC2",
                  }}
                >
                  {profile.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "#FAFAFA" }}>
                    {profile.name}
                  </h2>
                  <p className="text-xs font-medium" style={{ color: "#A1A1AA" }}>
                    {profile.degree} &apos;{profile.graduation_year.toString().slice(2)}
                  </p>
                </div>
              </div>
              {editingSection !== "identity" && (
                <button
                  onClick={() => startEdit("identity")}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all hover:opacity-80"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#A1A1AA",
                  }}
                >
                  <Pencil size={11} />
                  Edit
                </button>
              )}
            </div>

            {/* Location */}
            {editingSection === "identity" ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <FieldLabel>City</FieldLabel>
                  <EditInput value={draftCity} onChange={setDraftCity} placeholder="e.g. Bengaluru" />
                </div>
                <div className="space-y-1">
                  <FieldLabel>State</FieldLabel>
                  <EditInput value={draftState} onChange={setDraftState} placeholder="e.g. Karnataka" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={saveSection}
                    disabled={isSaving}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all"
                    style={{ background: "#00FFC2", color: "#050505" }}
                  >
                    {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }}
                  >
                    <X size={12} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-col">
                  <FieldLabel>Location</FieldLabel>
                  <span className="text-sm font-medium mt-0.5" style={{ color: "#FAFAFA" }}>
                    {profile.location.city}, {profile.location.state}
                  </span>
                </div>
                <div className="flex flex-col">
                  <FieldLabel>Contact</FieldLabel>
                  <span className="text-sm font-medium mt-0.5" style={{ color: "#A1A1AA" }}>
                    {profile.contact.email}
                  </span>
                </div>
              </div>
            )}
          </SectionCard>

          {/* ── Preferences Card ────────────────────────────────────────────── */}
          <SectionCard className="lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h3
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "#71717A" }}
              >
                Job Preferences
              </h3>
              {editingSection !== "preferences" && (
                <button
                  onClick={() => startEdit("preferences")}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all hover:opacity-80"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#A1A1AA",
                  }}
                >
                  <Pencil size={11} />
                  Edit Salary
                </button>
              )}
            </div>

            {editingSection === "preferences" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <FieldLabel>Min Salary (LPA)</FieldLabel>
                  <EditInput
                    type="number"
                    value={draftSalaryMin}
                    onChange={(v) => setDraftSalaryMin(Number(v))}
                    placeholder="8"
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Ideal Salary (LPA)</FieldLabel>
                  <EditInput
                    type="number"
                    value={draftSalaryIdeal}
                    onChange={(v) => setDraftSalaryIdeal(Number(v))}
                    placeholder="14"
                  />
                </div>
                <div className="col-span-2 flex gap-2 pt-1">
                  <button
                    onClick={saveSection}
                    disabled={isSaving}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
                    style={{ background: "#00FFC2", color: "#050505" }}
                  >
                    {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Save & Re-Validate Matches
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }}
                  >
                    <X size={12} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1">
                  <FieldLabel>Salary Requirement</FieldLabel>
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
            )}
          </SectionCard>

          {/* ── Tech Stack Card ──────────────────────────────────────────────── */}
          <SectionCard className="lg:col-span-3">
            <div className="flex items-center justify-between mb-2">
              <h3
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "#71717A" }}
              >
                Tech Stack &amp; Skills
              </h3>
              {editingSection !== "skills" && (
                <button
                  onClick={() => startEdit("skills")}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all hover:opacity-80"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#A1A1AA",
                  }}
                >
                  <Pencil size={11} />
                  Edit Stack
                </button>
              )}
            </div>

            {editingSection === "skills" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(draftSkills).map(([category, csv]) => (
                    <div key={category} className="space-y-1">
                      <FieldLabel>{category.replace("_", " ")}</FieldLabel>
                      <textarea
                        value={csv}
                        onChange={(e) =>
                          setDraftSkills((prev) => ({
                            ...prev,
                            [category]: e.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full resize-none rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 transition-all"
                        style={{
                          background: "#1A1A1A",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "#A1A1AA",
                        }}
                        placeholder="comma-separated skills"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveSection}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold"
                    style={{ background: "#00FFC2", color: "#050505" }}
                  >
                    {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Save & Re-Validate Matches
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }}
                  >
                    <X size={12} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
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
                      {category.replace("_", " ")}
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
            )}
          </SectionCard>

          {/* ── Experience Card ──────────────────────────────────────────────── */}
          <SectionCard className="lg:col-span-3">
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
                    style={{
                      background: "#00FFC2",
                    }}
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
          </SectionCard>

        </section>
      </div>
    </div>
  );
}
