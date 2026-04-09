"use client";

import { JobPost } from "@/types/job";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
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
      color: "#1D4ED8",
      background: "rgba(59,130,246,0.1)",
      border: "1px solid rgba(59,130,246,0.25)",
    };
  if (score >= 50)
    return {
      color: "#B45309",
      background: "rgba(245,158,11,0.1)",
      border: "1px solid rgba(245,158,11,0.25)",
    };
  return {
    color: "#B91C1C",
    background: "rgba(239,68,68,0.1)",
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
        background: primary ? "rgba(0, 255, 194, 0.15)" : "#F1F5F9",
        border: primary
          ? "1px solid rgba(0, 255, 194, 0.3)"
          : "1px solid #E2E8F0",
        color: primary ? "#047857" : "#475569",
      }}
    >
      {children}
    </span>
  );
}

// ─── Remote status dot + label ───────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  Remote:   "#047857", /* Emerald 700 */
  Hybrid:   "#1D4ED8", /* Blue 700 */
  "On-site":"#B45309", /* Amber 700 */
};
const STATUS_DOT: Record<string, string> = {
  Remote:   "#10B981", /* Emerald 500 */
  Hybrid:   "#3B82F6", /* Blue 500 */
  "On-site":"#F59E0B", /* Amber 500 */
};

function RemoteChip({ status }: { status: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
      style={{
        background: "#F1F5F9",
        border: "1px solid #E2E8F0",
        color: STATUS_COLOR[status] ?? "#475569",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: STATUS_DOT[status] ?? "#475569" }}
      />
      {status}
    </span>
  );
}

export function JobCard({ job, onClick }: { job: JobPost; onClick: (job: JobPost) => void }) {
  const topTech = job.tech_stack.slice(0, 3);
  const salaryLabel = `₹${job.pay.min}–${job.pay.max}L`;

  const handleApplyClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // don't open the sheet
    const quickIntro = `Hi! I'm an engineer passionate about building great products. I scored a ${job.match_score}% match for the ${job.role} position at ${job.company.name} and would love to chat.`;
    navigator.clipboard.writeText(quickIntro);
    toast.success("Quick Intro copied!", {
      description: "Paste it directly into your application or email.",
    });
    window.open(job.apply_url, "_blank");
  };

  return (
    <article
      id={`job-card-${job.id}`}
      role="button"
      tabIndex={0}
      onClick={() => onClick(job)}
      onKeyDown={(e) => e.key === "Enter" && onClick(job)}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-xl p-4 transition-all duration-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2"
      style={{
        background: "#FBFBFB",
        border: "1px solid #E2E8F0",
        ["--tw-ring-color" as string]: "var(--mint)",
      }}
    >
      {/* ── Top row: Company info + Score ──────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <p
            className="text-[11px] font-bold uppercase tracking-widest truncate"
            style={{ color: "#64748B", letterSpacing: "0.1em" }}
          >
            {job.company.name}
          </p>
          <h3
            className="text-sm font-bold leading-snug truncate"
            style={{ color: "#0F172A" }}
          >
            {job.role}
          </h3>
        </div>
        <div className="shrink-0 pt-0.5 flex items-center gap-2">
          <ScoreBadge score={job.match_score} />
          <Popover>
            <PopoverTrigger
              className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center p-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Info size={16} />
            </PopoverTrigger>
            <PopoverContent
              className="w-80 p-4 text-sm z-50 bg-white border shadow-lg rounded-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-1 text-slate-900">Why this match?</h4>
                  <p className="text-slate-600 leading-snug">
                    {job.match_explanation || "Alignment based on Tech Stack & Preferences."}
                  </p>
                </div>
                {job.missing_skills && job.missing_skills.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-1 text-slate-900">Missing Skills</h4>
                    <div className="flex flex-wrap gap-1">
                      {job.missing_skills.map((skill) => (
                        <Badge
                          key={skill}
                          variant="destructive"
                          className="bg-red-100 text-red-800 hover:bg-red-200 border-none px-1.5 py-0.5 text-[10px]"
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
        style={{ color: "#475569" }}
      >
        <span className="truncate">{job.experience_level}</span>
        <span style={{ color: "#CBD5E1" }}>·</span>
        <span className="truncate">{job.company.industry}</span>
        <span style={{ color: "#CBD5E1" }}>·</span>
        <span className="truncate">{job.company.size}</span>
      </div>

      {/* ── Description excerpt ─────────────────────────────────────────── */}
      <p
        className="line-clamp-2 text-[11.5px] leading-relaxed font-medium"
        style={{ color: "#64748B" }}
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
          style={{ background: "#0F172A", color: "#FBFBFB" }}
        >
          Apply • Quick Intro
        </Button>
      </div>
    </article>
  );
}
