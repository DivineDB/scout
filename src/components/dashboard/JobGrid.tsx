"use client";

import { useEffect, useState } from "react";
import { JobPost } from "@/types/job";
import { JobCard } from "./JobCard";
import { JobInsightSheet } from "./JobInsightSheet";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export function JobGrid() {
  const [selectedJob, setSelectedJob] = useState<JobPost | null>(null);
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchJobs() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "casual")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Only use real DB rows — mock jobs have fake UUIDs that cause 404s on promote
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
    
    // Listen for new jobs added to the database to refresh the UI immediately
    const channel = supabase
      .channel("jobs_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jobs" },
        () => fetchJobs()
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

  return (
    <div className="relative">
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#00FFC2" }} />
        </div>
      ) : jobs.length === 0 ? (
        <div
          className="p-12 rounded-2xl border text-center"
          style={{ background: "#121212", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-3xl mb-3">🎣</p>
          <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#71717A" }}>
            No jobs scouted yet
          </h3>
          <p className="mt-2 text-sm font-medium" style={{ color: "#A1A1AA" }}>
            Paste a job URL above and hit Scout to start filling your pipeline.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onClick={(j) => setSelectedJob(j)}
            />
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

