"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { JobPost } from "@/types/job";
import { Persona } from "@/types/persona";
import { morphResume } from "@/lib/morpher";
import { ResumeTemplate } from "@/components/ResumeTemplate";
import { ClientOnly } from "@/components/ClientOnly";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, FileDown, Copy, Check } from "lucide-react";
import { formatSalary } from "@/lib/format-salary";
import { supabase } from "@/lib/supabase";
import meData from "@/data/me.json";
import { toast } from "sonner";

// Dynamically import PDF components — client only, no SSR
const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  { ssr: false }
);
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFDownloadLink),
  { ssr: false }
);

// ─── PDF Skeleton loader ──────────────────────────────────────────────────────
function PDFSkeleton() {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-3"
      style={{ background: "#1A1A1A", borderRadius: "0.75rem" }}
    >
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#00FFC2" }} />
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#71717A" }}>
        Rendering PDF…
      </p>
    </div>
  );
}

// ─── Score colour ─────────────────────────────────────────────────────────────
function getScoreColor(score: number) {
  if (score >= 90) return "#00FFC2";
  if (score >= 70) return "#60A5FA";
  if (score >= 50) return "#FBBF24";
  return "#F87171";
}

export default function SeriousModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const id = use(params).id;
  const persona = meData as Persona;

  const [job, setJob] = useState<JobPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hookText, setHookText] = useState("");
  const [hookGenerating, setHookGenerating] = useState(false);
  const [hookCopied, setHookCopied] = useState(false);
  const [morphedProfile, setMorphedProfile] = useState<any>(null);
  const [gaps, setGaps] = useState<string[]>([]);
  const [gapsLoading, setGapsLoading] = useState(false);

  // ── Persist hook to Supabase ────────────────────────────────────────────────
  async function persistHook(jobId: string, hook: string) {
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ generated_hook: hook, updated_at: new Date().toISOString() })
        .eq("id", jobId);
      if (error) console.warn("Failed to persist hook:", error.message);
    } catch (err) {
      console.warn("Hook persist error:", err);
    }
  }

  // ── Generate hook from API ──────────────────────────────────────────────────
  async function generateHook(jobData: JobPost) {
    setHookGenerating(true);
    try {
      const res = await fetch("/api/job/generate-hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job: jobData, persona }),
      });
      const data = await res.json();
      if (data.hook) {
        setHookText(data.hook);
        await persistHook(jobData.id, data.hook);
      }
    } catch (err) {
      console.error("Error generating hook:", err);
    } finally {
      setHookGenerating(false);
    }
  }

  // ── Analyze gaps for low match scores ────────────────────────────────────
  async function analyzeGaps(jobData: JobPost) {
    setGapsLoading(true);
    try {
      const res = await fetch("/api/job/analyze-gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job: jobData, persona }),
      });
      const data = await res.json();
      if (data.gaps && Array.isArray(data.gaps)) {
        setGaps(data.gaps);
      }
    } catch (err) {
      console.error("Error analyzing gaps:", err);
    } finally {
      setGapsLoading(false);
    }
  }

  // ── Copy hook to clipboard ────────────────────────────────────────────────
  const copyHook = async () => {
    try {
      await navigator.clipboard.writeText(hookText);
      setHookCopied(true);
      toast.success("Hook copied to clipboard!");
      setTimeout(() => setHookCopied(false), 2000);
    } catch {
      toast.error("Failed to copy.");
    }
  };

  // ── Main data fetch ───────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchJobAndAssets() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        const fetched = data as JobPost;
        setJob(fetched);

        // Hook: use persisted value if exists, otherwise generate
        const storedHook = (fetched as any).generated_hook;
        if (storedHook && storedHook.trim().length > 0) {
          setHookText(storedHook);
        } else {
          generateHook(fetched);
        }

        // Gap Analysis: trigger if match_score < 70 and missing_skills is empty/short
        if (
          fetched.match_score < 70 &&
          (!fetched.missing_skills || fetched.missing_skills.length < 3)
        ) {
          analyzeGaps(fetched);
        }

        // Morph Resume
        const morphed = await morphResume(persona, fetched);
        setMorphedProfile(morphed);
      } catch (err) {
        console.error("Error fetching job:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchJobAndAssets();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading)
    return (
      <div className="flex h-screen w-full items-center justify-center" style={{ background: "#050505" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#00FFC2" }} />
      </div>
    );

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!job)
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4" style={{ background: "#050505" }}>
        <p className="font-bold text-lg" style={{ color: "#FAFAFA" }}>Job Not Found</p>
        <p className="text-sm -mt-2" style={{ color: "#A1A1AA" }}>
          This job may have been removed or the ID is invalid.
        </p>
        <Button
          onClick={() => router.push("/dashboard/serious")}
          className="mt-2"
          style={{ background: "#00FFC2", color: "#050505" }}
        >
          Return to Serious Queue
        </Button>
      </div>
    );

  const scoreColor = getScoreColor(job.match_score);

  // Decide what to show in the Skill Gaps section
  const displayGaps: string[] =
    job.missing_skills && job.missing_skills.length >= 3
      ? job.missing_skills
      : gaps;

  return (
    <div
      className="flex h-screen w-full overflow-hidden"
      style={{ background: "#050505", color: "#FAFAFA" }}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          LEFT PANE
      ════════════════════════════════════════════════════════════════════ */}
      <div
        className="w-[420px] min-w-[380px] max-w-[460px] flex flex-col z-10 shadow-2xl"
        style={{
          background: "#121212",
          borderRight: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Top bar */}
        <div
          className="p-4 flex items-center gap-3 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-8 w-8"
            style={{ background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span
            className="font-bold text-xs tracking-widest uppercase"
            style={{ color: "#00FFC2" }}
          >
            Serious Mode
          </span>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* ── Job header ───────────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#71717A" }}>
              {job.company.name}
            </p>
            <h1 className="text-xl font-black leading-tight mb-3" style={{ color: "#FAFAFA" }}>
              {job.role}
            </h1>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
              <span
                className="px-2 py-1 rounded-md"
                style={{ background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }}
              >
                {job.remote_status}
              </span>
              <span
                className="px-2 py-1 rounded-md"
                style={{ background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }}
              >
                {formatSalary(job.pay.min)} – {formatSalary(job.pay.max)}
              </span>
              <span
                className="px-2 py-1 rounded-md"
                style={{ background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }}
              >
                {job.experience_level}
              </span>
              <span
                className="px-2 py-1 rounded-md font-black"
                style={{
                  background: `${scoreColor}18`,
                  color: scoreColor,
                  border: `1px solid ${scoreColor}35`,
                }}
              >
                {job.match_score}% match
              </span>
            </div>
          </div>

          {/* ── AI Quick Hook ────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-sm text-[8px] font-black"
                  style={{ background: "#00FFC2", color: "#050505" }}
                >
                  Sc
                </span>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#71717A" }}>
                  AI Quick Hook
                </p>
              </div>
              {hookText && !hookGenerating && (
                <button
                  onClick={copyHook}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition-all"
                  style={{
                    background: hookCopied ? "rgba(0,255,194,0.1)" : "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: hookCopied ? "#00FFC2" : "#A1A1AA",
                  }}
                >
                  {hookCopied ? <Check size={10} /> : <Copy size={10} />}
                  {hookCopied ? "Copied" : "Copy"}
                </button>
              )}
            </div>

            {hookGenerating ? (
              <div
                className="flex items-center gap-2 rounded-lg p-4 text-sm"
                style={{
                  background: "#1A1A1A",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#71717A",
                }}
              >
                <Loader2 size={14} className="animate-spin" style={{ color: "#00FFC2" }} />
                <span className="text-xs">Generating outreach hook…</span>
              </div>
            ) : (
              <textarea
                id="quick-hook-textarea"
                value={hookText}
                onChange={(e) => setHookText(e.target.value)}
                rows={9}
                className="w-full resize-none rounded-lg p-3 text-[12.5px] leading-relaxed font-medium focus:outline-none focus:ring-2 transition-all"
                style={{
                  background: "#1A1A1A",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#A1A1AA",
                  "--tw-ring-color": "#00FFC2",
                } as React.CSSProperties}
                spellCheck={false}
              />
            )}
            <p className="text-[10px] font-medium mt-1 text-right" style={{ color: "#71717A" }}>
              Edit before sending · Scout-generated
            </p>
          </div>

          {/* ── Skill Gaps ───────────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#71717A" }}>
              Skill Gaps
            </p>

            {gapsLoading ? (
              <div className="flex items-center gap-2 text-xs" style={{ color: "#71717A" }}>
                <Loader2 size={12} className="animate-spin" style={{ color: "#00FFC2" }} />
                Analyzing capability gaps…
              </div>
            ) : displayGaps.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {displayGaps.map((gap, i) => (
                  <Badge
                    key={i}
                    className="text-[11px] font-semibold px-2 py-1 rounded-md max-w-full whitespace-normal text-left"
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      color: "#F87171",
                    }}
                  >
                    {gap}
                  </Badge>
                ))}
              </div>
            ) : job.match_score >= 70 ? (
              <p className="text-[12px] font-semibold" style={{ color: "#00FFC2" }}>
                No gaps detected 🎯 — strong alignment across the board.
              </p>
            ) : (
              <p className="text-[11px]" style={{ color: "#71717A" }}>
                Gap analysis pending…
              </p>
            )}
          </div>

          {/* ── Core Tech Stack ──────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#71717A" }}>
              Core Tech Stack
            </p>
            <div className="flex flex-wrap gap-1.5">
              {job.tech_stack.map((tech) => (
                <span
                  key={tech}
                  className="px-2 py-1 text-[11px] font-bold rounded-md"
                  style={{
                    background: "rgba(0,255,194,0.08)",
                    border: "1px solid rgba(0,255,194,0.2)",
                    color: "#00FFC2",
                  }}
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* ── About the Role ────────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#71717A" }}>
              About the Role
            </p>
            <p className="text-[12.5px] leading-relaxed font-medium" style={{ color: "#A1A1AA" }}>
              {job.description}
            </p>
          </div>

          {/* ── Match Explanation ─────────────────────────────────────────── */}
          {job.match_explanation && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#71717A" }}>
                Why This Match
              </p>
              <p
                className="text-[12.5px] leading-relaxed font-medium rounded-lg p-3"
                style={{
                  background: "rgba(0,255,194,0.06)",
                  border: "1px solid rgba(0,255,194,0.15)",
                  color: "#A1A1AA",
                }}
              >
                {job.match_explanation}
              </p>
            </div>
          )}
        </div>

        {/* Footer CTA — Download PDF */}
        <div
          className="p-5 shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "#0D0D0D" }}
        >
          <ClientOnly
            fallback={
              <div
                className="w-full py-3.5 rounded-md text-[13px] font-bold flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
                style={{ background: "#00FFC2", color: "#050505" }}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                PREPARING PDF…
              </div>
            }
          >
            {morphedProfile ? (
              <PDFDownloadLink
                document={<ResumeTemplate profile={morphedProfile} />}
                fileName={`Resume_${persona.name.replace(/\s+/g, "_")}_${job.company.name.replace(/\s+/g, "_")}.pdf`}
              >
                {({ loading }) => (
                  <div
                    className="w-full py-3.5 rounded-md text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-transform hover:scale-[0.99]"
                    style={{
                      background: "#00FFC2",
                      color: "#050505",
                      letterSpacing: "0.5px",
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> BUILDING PDF…</>
                    ) : (
                      <><FileDown className="h-4 w-4" /> DOWNLOAD TAILORED PDF</>
                    )}
                  </div>
                )}
              </PDFDownloadLink>
            ) : (
              <div
                className="w-full py-3.5 rounded-md text-[13px] font-bold flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
                style={{ background: "#00FFC2", color: "#050505" }}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                PREPARING PDF…
              </div>
            )}
          </ClientOnly>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT PANE — Live ATS Preview
      ════════════════════════════════════════════════════════════════════ */}
      <div
        className="flex-1 p-6 flex flex-col h-full overflow-hidden"
        style={{ background: "#0A0A0A" }}
      >
        <div className="mb-4 flex flex-col gap-0.5 shrink-0">
          <h2 className="text-lg font-black tracking-tight" style={{ color: "#FAFAFA" }}>
            Live ATS Preview
          </h2>
          <p className="text-[12px] font-medium" style={{ color: "#71717A" }}>
            {morphedProfile ? (
              <>
                Bullets re-ordered to surface:{" "}
                <span style={{ fontWeight: 700, color: "#00FFC2" }}>
                  {morphedProfile.top_keywords.join(", ")}
                </span>
              </>
            ) : (
              "Molding resume to technical theme…"
            )}
          </p>
        </div>

        <div
          className="flex-1 rounded-xl overflow-hidden shadow-2xl"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: "#fff",
          }}
        >
          <ClientOnly fallback={<PDFSkeleton />}>
            {morphedProfile ? (
              <PDFViewer style={{ width: "100%", height: "100%", border: "none" }}>
                <ResumeTemplate profile={morphedProfile} />
              </PDFViewer>
            ) : (
              <PDFSkeleton />
            )}
          </ClientOnly>
        </div>
      </div>
    </div>
  );
}
