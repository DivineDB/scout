"use client";

import { useEffect, useState } from "react";
import { JobPost } from "@/types/job";
import { JobCard } from "./JobCard";
import { JobInsightSheet } from "./JobInsightSheet";
import { supabase } from "@/lib/supabase";
import mockJobsData from "@/data/mock_jobs.json";

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

      // If we have live jobs, prepend them to the mock data for a full grid
      // or just show live jobs. Let's merge them for now.
      const liveJobs = (data || []) as JobPost[];
      setJobs([...liveJobs, ...mockJobsData as JobPost[]]);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      // Fallback to mock data on error
      setJobs(mockJobsData as JobPost[]);
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="relative">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onClick={(j) => setSelectedJob(j)}
          />
        ))}
      </div>

      <JobInsightSheet
        open={!!selectedJob}
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
      />
    </div>
  );
}

