"use client";

import { useEffect, useState } from "react";
import { JobPost } from "@/types/job";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

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
      <div className="pointer-events-none fixed inset-0 -z-10 h-full w-full bg-[#FBFBFB] [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#F1F5F9_100%)]" />

      <div className="mx-auto max-w-5xl space-y-6">
        <header className="mb-8 flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Serious Queue 🎯
          </h1>
          <p className="text-sm font-medium text-slate-500">
            High-match opportunities prioritized for customized applications and referrals.
          </p>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="glass p-12 rounded-2xl border border-slate-200 bg-white/50 text-center">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">No serious jobs yet</h3>
            <p className="text-slate-500 mt-2 font-medium">Promote jobs from the Casual Hunt to build your pipeline.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {jobs.map((job) => (
              <div 
                key={job.id} 
                className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-[#FBFBFB] hover:shadow-sm transition-all"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
                      {job.company.name}
                    </p>
                    <h3 className="text-base font-bold leading-snug text-slate-900 truncate">
                      {job.role}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-slate-900">₹{job.pay?.min}L - ₹{job.pay?.max}L</span>
                    <span className="text-[10px] font-semibold text-slate-500">{job.remote_status}</span>
                  </div>
                  
                  <div className="w-16 text-right">
                    <span 
                      className="inline-flex items-center rounded-md px-2 py-1 text-xs font-bold"
                      style={{
                        background: "rgba(0, 255, 194, 0.15)", // Carbon Mint
                        border: "1px solid rgba(0, 255, 194, 0.3)",
                        color: "#047857"
                      }}
                    >
                      {job.match_score}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
