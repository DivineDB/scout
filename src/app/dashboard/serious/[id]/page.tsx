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
import { ArrowLeft, Loader2, FileDown } from "lucide-react";
import { formatSalary } from "@/lib/format-salary";
import { supabase } from "@/lib/supabase";
import meData from "@/data/me.json";

// Dynamically import PDF components — client only, no SSR
const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  { ssr: false }
);
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFDownloadLink),
  { ssr: false }
);

// Removed buildQuickHook to use API route

// ─── PDF Skeleton loader for the right pane ──────────────────────────────────
function PDFSkeleton() {
  return (
    <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      <p className="text-[11px] font-semibold text-slate-400 tracking-wide uppercase">
        Rendering PDF…
      </p>
    </div>
  );
}

export default function SeriousModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const id = use(params).id;
  const [job, setJob] = useState<JobPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hookText, setHookText] = useState("");
  const [morphedProfile, setMorphedProfile] = useState<any>(null);
  const persona = meData as Persona;

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

        // Fetch Hook
        fetch("/api/job/generate-hook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job: fetched, persona }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.hook) setHookText(data.hook);
          })
          .catch((err) => console.error("Error fetching hook:", err));

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

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading)
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );

  // ── Not found state ────────────────────────────────────────────────────────
  if (!job)
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#FAFAFA] gap-4">
        <p className="font-bold text-slate-900 text-lg">Job Not Found</p>
        <p className="text-slate-500 -mt-2 text-sm">
          This job may have been removed or the ID is invalid.
        </p>
        <Button
          onClick={() => router.push("/dashboard/serious")}
          className="mt-2 bg-slate-900 text-white"
        >
          Return to Serious Queue
        </Button>
      </div>
    );

  // ── Morph the resume bullets based on this job's tech stack ───────────────
  // Handled in state via morphedProfile

  // ── Match score colour ─────────────────────────────────────────────────────
  const scoreColor =
    job.match_score >= 90
      ? "#047857"
      : job.match_score >= 70
      ? "#1D4ED8"
      : job.match_score >= 50
      ? "#B45309"
      : "#B91C1C";

  return (
    <div className="flex h-screen w-full bg-[#FAFAFA] overflow-hidden text-slate-800">

      {/* ═══════════════════════════════════════════════════════════════════════
          LEFT PANE
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="w-[400px] min-w-[360px] max-w-[440px] border-r border-[#E2E8F0] bg-white flex flex-col shadow-sm z-10">

        {/* Top bar */}
        <div className="p-4 border-b border-[#E2E8F0] flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-8 w-8 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4 text-slate-700" />
          </Button>
          <span className="font-bold text-sm tracking-wide text-slate-800">
            SERIOUS MODE
          </span>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* ── Job header ─────────────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              {job.company.name}
            </p>
            <h1 className="text-xl font-black leading-tight text-slate-900 mb-2">
              {job.role}
            </h1>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600 mb-1">
              <span className="px-2 py-0.5 bg-slate-100 rounded-sm">{job.remote_status}</span>
              <span className="px-2 py-0.5 bg-slate-100 rounded-sm">
                {formatSalary(job.pay.min)} – {formatSalary(job.pay.max)}
              </span>
              <span className="px-2 py-0.5 bg-slate-100 rounded-sm">{job.experience_level}</span>
              <span
                className="px-2 py-0.5 rounded-sm font-bold"
                style={{ background: "rgba(0,255,194,0.15)", color: scoreColor }}
              >
                {job.match_score}% match
              </span>
            </div>
          </div>

          {/* ── AI Quick Hook (editable) ────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span
                className="flex h-4 w-4 items-center justify-center rounded-sm text-[8px] font-black"
                style={{ background: "#00FFC2", color: "#0F172A" }}
              >
                Sc
              </span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                AI Quick Hook
              </p>
            </div>
            <textarea
              id="quick-hook-textarea"
              value={hookText}
              onChange={(e) => setHookText(e.target.value)}
              rows={9}
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12.5px] leading-relaxed font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00FFC2]/40 focus:border-[#00FFC2]/60 transition-all"
              spellCheck={false}
            />
            <p className="text-[10px] text-slate-400 font-medium mt-1 text-right">
              Edit before copying · Scout-generated
            </p>
          </div>

          {/* ── Skill Gaps ──────────────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Skill Gaps
            </p>
            {job.missing_skills && job.missing_skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {job.missing_skills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="destructive"
                    className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 px-2 py-0.5 text-[11px] font-semibold"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-[12px] font-semibold text-emerald-600">
                No gaps detected 🎯 — strong alignment across the board.
              </p>
            )}
          </div>

          {/* ── Core Tech Stack ─────────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Core Tech Stack
            </p>
            <div className="flex flex-wrap gap-1.5">
              {job.tech_stack.map((tech) => (
                <span
                  key={tech}
                  className="px-2 py-1 text-[11px] font-bold rounded-sm"
                  style={{
                    background: "rgba(0,255,194,0.10)",
                    color: "#047857",
                  }}
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* ── Job description ─────────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              About the Role
            </p>
            <p className="text-[12.5px] leading-relaxed font-medium text-slate-600">
              {job.description}
            </p>
          </div>
        </div>

        {/* Footer CTA — Download PDF */}
        <div className="p-5 border-t border-[#E2E8F0] bg-slate-50 shrink-0">
          <ClientOnly
            fallback={
              <div
                className="w-full py-3.5 rounded-md text-[13px] font-bold flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
                style={{ background: "#0F172A", color: "#00FFC2", border: "1px solid #00FFC2" }}
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
                    className="w-full py-3.5 rounded-md text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-transform hover:scale-[0.99] font-sans"
                    style={{
                      background: "#0F172A",
                      color: "#00FFC2",
                      border: "1px solid #00FFC2",
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
                style={{ background: "#0F172A", color: "#00FFC2", border: "1px solid #00FFC2" }}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                PREPARING PDF…
              </div>
            )}
          </ClientOnly>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          RIGHT PANE — Live ATS Preview
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 bg-[#F1F5F9] p-6 flex flex-col h-full overflow-hidden">
        <div className="mb-4 flex flex-col gap-0.5 shrink-0">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Live ATS Preview
          </h2>
          <p className="text-[12px] font-medium text-slate-500">
            {morphedProfile ? (
              <>
                Bullets re-ordered to surface:{" "}
                <span className="font-bold text-[#047857]">
                  {morphedProfile.top_keywords.join(", ")}
                </span>
              </>
            ) : (
              "Molding resume to Technical Theme..."
            )}
          </p>
        </div>

        <div className="flex-1 rounded-xl border border-slate-300 shadow-lg overflow-hidden bg-white">
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
