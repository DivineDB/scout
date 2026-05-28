"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { JobPost } from "@/types/job";
import { supabase } from "@/lib/supabase";
import { Loader2, Info, ArrowLeftRight, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { formatSalary } from "@/lib/format-salary";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

// Define our Kanban Columns and their corresponding Supabase DB status values
const COLUMNS = [
  { id: "serious", label: "Serious Pipeline", border: "rgba(16,185,129,0.3)" },
  { id: "applied", label: "Applied", border: "rgba(59,130,246,0.3)" },
  { id: "interviewing", label: "Interviewing", border: "rgba(168,85,247,0.3)" },
  { id: "rejected", label: "Archived (Rejected)", border: "rgba(239,68,68,0.2)" },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];

export default function PipelinePage() {
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [activeOverColumn, setActiveOverColumn] = useState<ColumnId | null>(null);

  // Fetch all pipeline jobs (serious, applied, interviewing, rejected)
  const fetchPipelineJobs = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .in("status", ["serious", "applied", "interviewing", "rejected"])
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setJobs((data as JobPost[]) || []);
    } catch (err) {
      console.error("Error fetching pipeline jobs:", err);
      toast.error("Failed to load pipeline jobs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPipelineJobs();
  }, []);

  // Snappy optimistic column transition handler
  const moveJobStatus = async (jobId: string, newStatus: ColumnId) => {
    const jobToUpdate = jobs.find((j) => j.id === jobId);
    if (!jobToUpdate) return;
    if (jobToUpdate.status === newStatus) return;

    const previousStatus = jobToUpdate.status as ColumnId;

    // 1. Optimistic Update (0ms latency feel)
    setJobs((prevJobs) =>
      prevJobs.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
    );

    const toastMsg = `Moved to ${
      COLUMNS.find((c) => c.id === newStatus)?.label
    }`;
    const toastId = toast.success(toastMsg, {
      description: jobToUpdate.role + " at " + jobToUpdate.company.name,
      id: `move-${jobId}`,
    });

    try {
      // 2. Perform background database patch sync
      const res = await fetch("/api/job/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, updates: { status: newStatus } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
    } catch (err: any) {
      // 3. Rollback UI on failure
      setJobs((prevJobs) =>
        prevJobs.map((j) => (j.id === jobId ? { ...j, status: previousStatus } : j))
      );
      toast.error("Failed to move job", {
        description: err.message,
        id: `move-${jobId}`, // overwrite the success toast
      });
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    setDraggedJobId(jobId);
    e.dataTransfer.setData("text/plain", jobId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnId: ColumnId) => {
    e.preventDefault();
    if (activeOverColumn !== columnId) {
      setActiveOverColumn(columnId);
    }
  };

  const handleDragLeave = () => {
    setActiveOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: ColumnId) => {
    e.preventDefault();
    setActiveOverColumn(null);
    const jobId = e.dataTransfer.getData("text/plain") || draggedJobId;
    if (jobId) {
      moveJobStatus(jobId, targetStatus);
    }
    setDraggedJobId(null);
  };

  return (
    <div className="flex-1 overflow-auto p-8 relative flex flex-col min-h-screen">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% -10%, rgba(255,255,255,0.02) 0%, transparent 80%)",
        }}
      />

      {/* Header */}
      <header className="mb-8 shrink-0">
        <h1 className="text-[28px] font-black tracking-tighter text-foreground">
          Obsidian Pipeline
        </h1>
        <p className="text-xs font-medium text-foreground/40 mt-1">
          Snappy visual job funnel tracking. Drag cards or use triggers to progress stages.
        </p>
      </header>

      {/* Kanban Board Container */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-mint" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 items-stretch">
          {COLUMNS.map((column) => {
            const columnJobs = jobs.filter((j) => j.status === column.id);
            const isDraggingOver = activeOverColumn === column.id;

            return (
              <div
                key={column.id}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`flex flex-col rounded-xl border p-4 transition-all duration-200 min-h-[500px] md:min-h-0 bg-[#09090b]/40 backdrop-blur-sm ${
                  isDraggingOver
                    ? "bg-white/[0.02] border-white/20 scale-[1.01]"
                    : "border-[var(--border-subtle)]"
                }`}
                style={{
                  borderTop: `3px solid ${column.border}`,
                }}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.04] shrink-0">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground/50">
                    {column.label}
                  </h3>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/[0.05] text-foreground/40 tabular-nums">
                    {columnJobs.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[150px]">
                  {columnJobs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center border border-dashed border-white/[0.02] rounded-lg py-12 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/20">
                        Empty Stage
                      </p>
                    </div>
                  ) : (
                    columnJobs.map((job) => (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, job.id)}
                        className="obsidian-card p-4 hover:border-white/10 hover:shadow-lg transition-all duration-200 cursor-grab active:cursor-grabbing group relative select-none"
                      >
                        {/* Title block */}
                        <div className="flex flex-col gap-0.5 pr-6">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">
                            {job.company.name}
                          </p>
                          <h4 className="text-xs font-semibold text-foreground tracking-tight leading-snug">
                            {job.role}
                          </h4>
                        </div>

                        {/* Middle info */}
                        <div className="flex items-center justify-between mt-3 text-[10px] font-medium text-foreground/50">
                          <span>
                            ₹{job.pay?.min ? formatSalary(job.pay.min) : "N/A"}
                          </span>
                          <span className="text-foreground/30">•</span>
                          <span>{job.remote_status}</span>
                        </div>

                        {/* Bottom mapping indicator & Actions */}
                        <div className="mt-4 pt-2 border-t border-white/[0.04] flex items-center justify-between">
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/[0.05] text-foreground/40">
                            {job.match_score}% MATCH
                          </span>

                          <div className="flex items-center gap-1">
                            {/* ⓘ Info Popover */}
                            <Popover>
                              <PopoverTrigger className="text-foreground/30 hover:text-foreground/60 p-1 transition-colors">
                                <Info size={12} />
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-72 p-4 text-xs z-[9999] shadow-2xl rounded-xl backdrop-blur-xl"
                                style={{
                                  background: "rgba(9, 9, 11, 0.98)",
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  color: "var(--foreground)",
                                }}
                              >
                                <div className="space-y-3">
                                  <div>
                                    <h4 className="font-bold text-[10px] uppercase tracking-widest text-foreground/40 mb-1">
                                      Match Rationale
                                    </h4>
                                    <p className="leading-relaxed text-foreground/70 font-medium">
                                      {job.match_explanation || "No rationale distilled."}
                                    </p>
                                  </div>
                                  {job.tech_stack && job.tech_stack.length > 0 && (
                                    <div>
                                      <h4 className="font-bold text-[10px] uppercase tracking-widest text-foreground/40 mb-1.5">
                                        Stack
                                      </h4>
                                      <div className="flex flex-wrap gap-1">
                                        {job.tech_stack.slice(0, 5).map((tech) => (
                                          <Badge
                                            key={tech}
                                            className="text-[9px] font-semibold bg-white/5 border border-white/10 text-foreground/60 px-1 py-0"
                                          >
                                            {tech}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>

                            {/* Shift Column popover (dropdown fallback for mobile/touch/accessibility) */}
                            <Popover>
                              <PopoverTrigger className="text-foreground/30 hover:text-foreground/60 p-1 transition-colors" title="Change funnels">
                                <ArrowLeftRight size={12} />
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-40 p-2 z-[9999] shadow-2xl rounded-lg bg-[#09090b] border border-white/10"
                                align="end"
                              >
                                <p className="text-[8px] font-black uppercase tracking-widest text-foreground/30 px-2 py-1">
                                  Shift Funnel
                                </p>
                                <div className="flex flex-col gap-0.5 mt-1">
                                  {COLUMNS.map((c) => {
                                    if (c.id === column.id) return null;
                                    return (
                                      <button
                                        key={c.id}
                                        onClick={() => moveJobStatus(job.id, c.id)}
                                        className="text-left text-[10px] font-bold text-foreground/60 hover:text-foreground hover:bg-white/5 px-2 py-1.5 rounded transition-all flex items-center justify-between"
                                      >
                                        {c.label}
                                        <ArrowRight size={10} className="text-mint opacity-60" />
                                      </button>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        {/* Top corner detailed link to insight workspace */}
                        <Link
                          href={`/dashboard/serious/${job.id}`}
                          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-mint hover:scale-105 z-10"
                          title="Open workspace"
                        >
                          <ArrowRight size={12} />
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
