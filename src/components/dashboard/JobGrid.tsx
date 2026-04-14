"use client";

import { useEffect, useRef, useState } from "react";
import { JobPost } from "@/types/job";
import { JobCard } from "./JobCard";
import { JobInsightSheet } from "./JobInsightSheet";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowUp } from "lucide-react";
import { toast } from "sonner";

export function JobGrid() {
  const [selectedJob, setSelectedJob]     = useState<JobPost | null>(null);
  const [jobs, setJobs]                   = useState<JobPost[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [newJobIds, setNewJobIds]         = useState<Set<string>>(new Set());
  const [showNewBanner, setShowNewBanner] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  async function fetchJobs() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "casual")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobs((data || []) as JobPost[]);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchJobs();

    const channel = supabase
      .channel("jobs_casuals_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jobs" },
        (payload) => {
          const newJob = payload.new as JobPost & { source?: string };

          // Ghost-scouted job: show celebration toast + flash badge
          if (newJob?.source === "ghost" || newJob?.source === "serper" ||
              newJob?.source === "remoteok" || newJob?.source === "remotive") {
            const score = newJob.match_score ?? 0;
            const emoji = score >= 95 ? "🦄" : score >= 85 ? "🔥" : "👻";
            toast.success(
              `${emoji} Ghost found a ${score}% match!`,
              {
                description: `${newJob.role ?? "New job"} at ${(newJob.company as { name?: string })?.name ?? "Unknown"}`,
                duration: 6000,
                action: {
                  label: "View",
                  onClick: () => setSelectedJob(newJob),
                },
              }
            );

            // Highlight the new card briefly
            if (newJob.id) {
              setNewJobIds((prev) => new Set([...prev, newJob.id]));
              setTimeout(() => {
                setNewJobIds((prev) => {
                  const next = new Set(prev);
                  next.delete(newJob.id);
                  return next;
                });
              }, 4000);
            }

            setShowNewBanner(true);
          }

          fetchJobs();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs" },
        () => fetchJobs()
      )
      .subscribe();

    window.addEventListener("scout-refresh", fetchJobs);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("scout-refresh", fetchJobs);
    };
  }, []);

  function scrollToTop() {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowNewBanner(false);
  }

  return (
    <div className="relative" ref={topRef}>
      {/* "New jobs" floating banner */}
      {showNewBanner && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-2xl transition-all duration-300 animate-bounce"
          style={{
            background: "rgba(0,255,194,0.15)",
            border: "1px solid rgba(0,255,194,0.4)",
            color: "#00FFC2",
            backdropFilter: "blur(12px)",
          }}
        >
          <ArrowUp className="h-3.5 w-3.5" />
          Ghost found new matches — scroll up
        </button>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#00FFC2" }} />
        </div>
      ) : jobs.length === 0 ? (
        <div
          className="p-12 rounded-2xl border text-center mt-6"
          style={{ background: "#121212", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-3xl mb-3">👻</p>
          <h3
            className="text-sm font-bold uppercase tracking-widest"
            style={{ color: "#71717A" }}
          >
            Ghost is warming up
          </h3>
          <p className="mt-2 text-sm font-medium" style={{ color: "#A1A1AA" }}>
            The nightly sweep runs at 9:00 AM IST. Paste a URL above to scout manually now.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="relative transition-all duration-500"
              style={
                newJobIds.has(job.id)
                  ? {
                      outline: "1.5px solid rgba(0,255,194,0.5)",
                      borderRadius: "1rem",
                      boxShadow: "0 0 20px rgba(0,255,194,0.12)",
                    }
                  : {}
              }
            >
              {/* Ghost badge for auto-scouted jobs */}
              {(job as JobPost & { source?: string }).source &&
                (job as JobPost & { source?: string }).source !== "manual" && (
                  <span
                    className="absolute -top-2 -right-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      background: "rgba(0,255,194,0.12)",
                      border: "1px solid rgba(0,255,194,0.3)",
                      color: "#00FFC2",
                    }}
                  >
                    👻 Auto
                  </span>
                )}
              <JobCard
                job={job}
                onClick={(j) => setSelectedJob(j)}
              />
            </div>
          ))}
        </div>
      )}

      <JobInsightSheet
        open={!!selectedJob}
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
      />
    </div>
  );
}
