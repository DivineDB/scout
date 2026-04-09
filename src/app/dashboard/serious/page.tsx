"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { JobPost } from "@/types/job";
import { supabase } from "@/lib/supabase";
import { Loader2, Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { formatSalary } from "@/lib/format-salary";

// ─── Score badge helpers (mirrors JobCard.tsx) ────────────────────────────────
function getScoreStyle(score: number): React.CSSProperties {
  if (score >= 90) return { color: "#0F172A",  background: "#00FFC2",               border: "1px solid rgba(0,255,194,0.5)" };
  if (score >= 70) return { color: "#1D4ED8",  background: "rgba(59,130,246,0.1)",  border: "1px solid rgba(59,130,246,0.25)" };
  if (score >= 50) return { color: "#B45309",  background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" };
  return              { color: "#B91C1C",  background: "rgba(239,68,68,0.1)",  border: "1px solid rgba(239,68,68,0.2)" };
}

export default function SeriousQueuePage() {
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
    fetchSerious();
  }, []);

  return (
    <div className="flex-1 overflow-auto p-8 relative">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,255,194,0.03) 0%, transparent 60%)",
        }}
      />

      <div className="mx-auto max-w-5xl space-y-6">
        <header className="mb-8 flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight" style={{ color: "#FAFAFA" }}>
            Serious Queue 🎯
          </h1>
          <p className="text-sm font-medium" style={{ color: "#A1A1AA" }}>
            High-match opportunities prioritized for customized applications.
          </p>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : jobs.length === 0 ? (
          <div
            className="p-12 rounded-2xl border text-center"
            style={{
              background: "#121212",
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#71717A" }}>No serious jobs yet</h3>
            <p className="mt-2 font-medium" style={{ color: "#A1A1AA" }}>Promote jobs from the Casual Hunt to build your pipeline.</p>
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
                    className="flex items-center justify-between p-4 rounded-xl transition-all duration-150"
                    style={{
                      background: "#121212",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                    }}
                  >
                    {/* Left: company + role */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color: "#71717A" }}>
                          {job.company.name}
                        </p>
                        <h3 className="text-base font-bold leading-snug truncate" style={{ color: "#FAFAFA" }}>
                          {job.role}
                        </h3>
                      </div>
                    </div>

                    {/* Right: pay + remote + score + ⓘ */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-bold" style={{ color: "#FAFAFA" }}>
                          {formatSalary(job.pay?.min)} – {formatSalary(job.pay?.max)}
                        </span>
                        <span className="text-[10px] font-semibold" style={{ color: "#71717A" }}>
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
                          <PopoverTrigger
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1 rounded relative z-20"
                          >
                            <Info size={15} />
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-80 p-4 text-sm z-[9999] shadow-xl rounded-xl overflow-visible"
                            style={{
                              background: "#121212",
                              border: "1px solid rgba(255,255,255,0.1)",
                              color: "#A1A1AA",
                            }}
                          >
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-bold text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "#71717A" }}>
                                  Why this job?
                                </h4>
                                <p className="text-[12.5px] leading-relaxed font-medium" style={{ color: "#A1A1AA" }}>
                                  {job.match_explanation || (
                                    <span className="italic" style={{ color: "#52525B" }}>
                                      Match explanation not available.
                                    </span>
                                  )}
                                </p>
                              </div>
                              {job.missing_skills && job.missing_skills.length > 0 && (
                                <div>
                                  <h4 className="font-bold text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "#71717A" }}>
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
