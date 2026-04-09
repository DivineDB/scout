"use client";

import { useState } from "react";
import { JobPost } from "@/types/job";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Info, Loader2, Sparkles } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

// ─── Score badge helpers ───────────────────────────────────────────────────────
function getScoreStyle(score: number): {
  color: string;
  background: string;
  border: string;
} {
  if (score >= 90)
    return {
      color: "#0F172A",
      background: "#00FFC2", /* Carbon Mint */
      border: "1px solid rgba(0, 255, 194, 0.5)",
    };
  if (score >= 70)
    return {
      color: "#93C5FD",
      background: "rgba(59,130,246,0.12)",
      border: "1px solid rgba(59,130,246,0.25)",
    };
  if (score >= 50)
    return {
      color: "#FCD34D",
      background: "rgba(245,158,11,0.12)",
      border: "1px solid rgba(245,158,11,0.25)",
    };
  return {
    color: "#FCA5A5",
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.2)",
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
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
      style={{
        background: primary ? "rgba(0, 255, 194, 0.1)" : "rgba(255,255,255,0.06)",
        border: primary
          ? "1px solid rgba(0, 255, 194, 0.25)"
          : "1px solid rgba(255,255,255,0.1)",
        color: primary ? "#00FFC2" : "var(--muted-foreground)",
      }}
    >
      {children}
    </span>
  );
}

// ─── Remote status dot + label ───────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  Remote:   "#34D399",
  Hybrid:   "#60A5FA",
  "On-site":"#FBBF24",
};
const STATUS_DOT: Record<string, string> = {
  Remote:   "#10B981",
  Hybrid:   "#3B82F6",
  "On-site":"#F59E0B",
};

function RemoteChip({ status }: { status: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        color: STATUS_COLOR[status] ?? "var(--muted-foreground)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: STATUS_DOT[status] ?? "#71717A" }}
      />
      {status}
    </span>
  );
}

// ─── Main JobCard ────────────────────────────────────────────────────────────
export function JobCard({ job: initialJob, onClick }: { job: JobPost; onClick: (job: JobPost) => void }) {
  const [job, setJob] = useState<JobPost>(initialJob);
  const [isRedistilling, setIsRedistilling] = useState(false);

  const topTech = job.tech_stack.slice(0, 3);
  const salaryLabel = `₹${job.pay.min}–${job.pay.max}L`;

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
      id={`job-card-${job.id}`}
      role="button"
      tabIndex={0}
      onClick={() => onClick(job)}
      onKeyDown={(e) => e.key === "Enter" && onClick(job)}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-xl p-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2"
      style={{
        background: "var(--card)",
        border: "1px solid rgba(255,255,255,0.08)",
        ["--tw-ring-color" as string]: "var(--primary)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.16)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
      }}
    >
      {/* Stale indicator dot */}
      {job.match_stale && (
        <span
          className="absolute top-3 right-3 h-1.5 w-1.5 rounded-full"
          style={{ background: "#F59E0B" }}
          title="Match score is stale — profile updated"
        />
      )}

      {/* ── Top row: Company info + Score ──────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <p
            className="text-[11px] font-bold uppercase tracking-widest truncate"
            style={{ color: "var(--muted-foreground)", letterSpacing: "0.1em" }}
          >
            {job.company.name}
          </p>
          <h3
            className="text-sm font-bold leading-snug truncate"
            style={{ color: "var(--card-foreground)" }}
          >
            {job.role}
          </h3>
        </div>
        <div className="shrink-0 pt-0.5 flex items-center gap-2">
          <ScoreBadge score={job.match_score} />
          <Popover>
            <PopoverTrigger
              className="transition-colors flex items-center justify-center p-1 rounded"
              style={{ color: "var(--muted-foreground)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <Info size={15} />
            </PopoverTrigger>
            <PopoverContent
              className="w-80 p-4 text-sm z-[9999] border shadow-xl rounded-xl"
              style={{
                background: "var(--popover)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "var(--popover-foreground)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                <div>
                  <h4
                    className="text-[11px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Why this match?
                  </h4>
                  {job.match_explanation ? (
                    <p className="text-[12.5px] leading-relaxed font-medium" style={{ color: "var(--popover-foreground)" }}>
                      {job.match_explanation}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[12px] italic" style={{ color: "var(--muted-foreground)" }}>
                        No explanation available for this match.
                      </p>
                      <button
                        onClick={handleRedistill}
                        disabled={isRedistilling}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition-all"
                        style={{
                          background: "rgba(0,255,194,0.1)",
                          border: "1px solid rgba(0,255,194,0.3)",
                          color: "#00FFC2",
                          opacity: isRedistilling ? 0.6 : 1,
                        }}
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
                    <h4
                      className="text-[11px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: "var(--muted-foreground)" }}
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

      {/* ── Middle: meta row ────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 text-[11px] font-medium"
        style={{ color: "var(--muted-foreground)" }}
      >
        <span className="truncate">{job.experience_level}</span>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
        <span className="truncate">{job.company.industry}</span>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
        <span className="truncate">{job.company.size}</span>
      </div>

      {/* ── Description excerpt ─────────────────────────────────────────── */}
      <p
        className="line-clamp-2 text-[11.5px] leading-relaxed font-medium"
        style={{ color: "var(--muted-foreground)" }}
      >
        {job.description}
      </p>

      {/* ── Bottom badges ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <RemoteChip status={job.remote_status} />
        <Chip>{salaryLabel}</Chip>
        {topTech.map((tech) => (
          <Chip key={tech} primary>{tech}</Chip>
        ))}
        {job.tech_stack.length > 3 && (
          <Chip>+{job.tech_stack.length - 3}</Chip>
        )}
      </div>

      {/* ── Hover CTAs ──────────────────────────────────────────────────── */}
      <div className="mt-2 flex opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <Button
          size="sm"
          className="w-full text-xs font-bold"
          onClick={handleApplyClick}
          style={{ background: "#00FFC2", color: "#050505" }}
        >
          Apply • Quick Intro
        </Button>
      </div>
    </article>
  );
}
