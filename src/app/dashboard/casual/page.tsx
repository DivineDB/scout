"use client";

import { useState } from "react";
import { Ghost, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { JobGrid } from "@/components/dashboard/JobGrid";
import { ScoutInput } from "@/components/dashboard/ScoutInput";
import { FilterBar } from "@/components/FilterBar";

export default function CasualHuntPage() {
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepProgress, setSweepProgress] = useState(0);
  const [sweepMessage, setSweepMessage] = useState("");
  const [showProgress, setShowProgress] = useState(false);
  const [fadeProgress, setFadeProgress] = useState(false);

  async function handleGhostSweep() {
    setIsSweeping(true);
    setShowProgress(true);
    setFadeProgress(false);
    setSweepProgress(0);
    setSweepMessage("Booting Ghost Scouter engine...");

    const toastId = toast.loading("Launching live Ghost Sweep...");

    const eventSource = new EventSource("/api/ghost/trigger");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const progress = typeof data.progress === "number" ? data.progress : 0;
        const message = typeof data.message === "string" ? data.message : "";

        setSweepProgress(progress);
        setSweepMessage(message);

        if (progress >= 100) {
          eventSource.close();
          toast.success("Sweep completed! 👻", {
            id: toastId,
            description: message || "New matching jobs loaded.",
          });
          
          setTimeout(() => {
            setFadeProgress(true);
            setTimeout(() => {
              setShowProgress(false);
              setIsSweeping(false);
            }, 500);
          }, 3000);
        }
      } catch (err) {
        console.error("Error parsing SSE data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE stream error:", err);
      eventSource.close();
      setSweepProgress(100);
      setSweepMessage("Sweep halted or connection interrupted.");
      toast.error("Sweep connection interrupted", { id: toastId });

      setTimeout(() => {
        setFadeProgress(true);
        setTimeout(() => {
          setShowProgress(false);
          setIsSweeping(false);
        }, 500);
      }, 3000);
    };
  }

  return (
    <div className="flex flex-col w-full min-h-screen">
      {/* Sticky Filter Bar */}
      <FilterBar />

      {/* Premium Feedback GhostTerminal UI */}
      {showProgress && (
        <div
          className={`w-full transition-opacity duration-500 ease-out z-40 relative px-6 md:px-10 pt-6 pb-2 ${
            fadeProgress ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="mx-auto w-full max-w-7xl rounded-xl p-5 border border-default bg-[var(--surface-2)] glass-card shadow-2xl space-y-3">
            {/* Progress Track */}
            <div className="h-1.5 w-full bg-[var(--surface-3)] overflow-hidden rounded-full">
              <div
                className="h-full bg-[var(--mint)] shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-all duration-300 ease-out"
                style={{ width: `${sweepProgress}%` }}
              />
            </div>

            {/* Terminal Details & Message */}
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] font-mono text-mint tracking-wider animate-pulse uppercase">
                ⚡ {sweepMessage}
              </p>
              <span className="text-[10px] font-mono text-[var(--text-3)]">
                {sweepProgress}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Page Content */}
      <div className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10 md:py-10">
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] font-black tracking-tighter text-foreground">
              Casual Hunt
            </h1>
            <p className="text-xs font-medium text-foreground/40">
              Ghost scouts while you sleep. Swipe through matches, apply fast.
            </p>
          </div>

          {/* Right Consolidated Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 max-w-full md:max-w-xl shrink-0">
            <ScoutInput />

            {/* Ghost Sweep Trigger Button */}
            <button
              onClick={handleGhostSweep}
              disabled={isSweeping}
              suppressHydrationWarning
              className="flex items-center justify-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 h-8 text-[10px] font-black uppercase tracking-widest text-white/50 transition-all duration-200 hover:bg-white/[0.08] hover:border-white/15 hover:text-white/80 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {isSweeping ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Ghost size={12} />
              )}
              {isSweeping ? "Sweeping…" : "New Ghost Sweep"}
            </button>
          </div>
        </header>

        <JobGrid />
      </div>
    </div>
  );
}
