"use client";

import { useState } from "react";
import { JobPost } from "@/types/job";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em]"
      style={{ color: "#71717A" }}
    >
      {children}
    </p>
  );
}

function CheckRow({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-[12.5px]" style={{ color: "#A1A1AA" }}>
      <span className="mt-0.5 text-[11px]" style={{ color: "#00FFC2" }}>✓</span>
      <span className="leading-relaxed font-medium">{text}</span>
    </li>
  );
}

export function JobInsightSheet({
  job,
  open,
  onClose,
}: {
  job: JobPost | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPromoting, setIsPromoting] = useState(false);
  const [isRedistilling, setIsRedistilling] = useState(false);

  if (!job) return null;

  const isPending = !!(job as any).distillation_pending;

  const handleApply = () => {
    const quickIntro = `Hi! I'm an engineer passionate about building great products. I scored a ${job.match_score}% match for the ${job.role} position at ${job.company.name} and would love to chat.`;
    navigator.clipboard.writeText(quickIntro);
    toast.success("Quick Intro copied!", {
      description: "Paste it directly into your application.",
    });
    window.open(job.apply_url, "_blank");
  };

  const handleRedistill = async () => {
    setIsRedistilling(true);
    const toastId = toast.loading("Re-distilling with AI…");
    try {
      const res = await fetch("/api/scout/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Distillation failed");
      toast.success("Job distilled! Refreshing…", { id: toastId });
      router.refresh();
      onClose();
    } catch (err: any) {
      toast.error(`Distillation failed: ${err.message}`, { id: toastId });
    } finally {
      setIsRedistilling(false);
    }
  };

  const promoteJobToSerious = async () => {
    // Validate UUID before attempting update
    const jobId = job?.id;
    if (!jobId || typeof jobId !== "string" || jobId.trim() === "") {
      toast.error("Cannot promote: Job ID is missing or invalid.", {
        description: "This may be a mock job that was not saved to the database.",
      });
      return;
    }

    setIsPromoting(true);
    const toastId = toast.loading("Moving to Serious Mode...");

    try {
      const res = await fetch("/api/job/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, updates: { status: "serious" } }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Surface the real technical HTTP error so we can see the bottleneck
        toast.error(`[Status: ${res.status}] ${res.statusText} - ${data.error || "Unknown error"}`, { id: toastId });
        return;
      }

      toast.success("Added to your Serious Queue! 🚀", { id: toastId });
      onClose();
      router.push("/dashboard/serious");
    } catch (err: any) {
      toast.error(`Unexpected error: ${err?.message ?? String(err)}`, { id: toastId });
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        className="flex flex-col outline-none w-[90vw] max-w-[440px] p-0 sm:max-w-[440px]"
        style={{
          background: "#050505",
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <SheetHeader
          className="border-b px-5 py-4 shrink-0 text-left"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
        >
          <div>
            <SheetDescription className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#71717A" }}>
              {job.company.name} · {job.company.industry}
            </SheetDescription>
            <SheetTitle className="text-lg font-bold leading-snug mt-0.5" style={{ color: "#FAFAFA" }}>
              {job.role}
            </SheetTitle>
            <p className="mt-1 text-xs font-semibold" style={{ color: "#A1A1AA" }}>
              {job.remote_status} · {job.location} · ₹{job.pay.min}–{job.pay.max}L
            </p>
          </div>
        </SheetHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Pending distillation banner */}
          {isPending && (
            <div
              className="rounded-lg p-4 flex flex-col gap-3"
              style={{
                background: "rgba(251,191,36,0.06)",
                border: "1px solid rgba(251,191,36,0.25)",
              }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: "#FBBF24" }}>⏳</span>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#FBBF24" }}>
                  Pending AI Distillation
                </p>
              </div>
              <p className="text-xs leading-relaxed font-medium" style={{ color: "#A1A1AA" }}>
                The AI hasn&apos;t analysed this job yet. Hit Re-distill to extract the full role details, match score, and skill gaps now.
              </p>
              <button
                onClick={handleRedistill}
                disabled={isRedistilling}
                className="flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  background: "rgba(251,191,36,0.12)",
                  border: "1px solid rgba(251,191,36,0.3)",
                  color: "#FBBF24",
                }}
              >
                {isRedistilling ? (
                  <><Loader2 size={12} className="animate-spin" /> Distilling…</>
                ) : (
                  "✨ Re-distill with AI"
                )}
              </button>
            </div>
          )}

          {!isPending && (
            <>
          {/* AI Distilled Summary */}
          <section>
            <SectionLabel>AI-Distilled Insight</SectionLabel>
            <div
              className="rounded-lg p-3.5 text-[12.5px] leading-relaxed font-semibold shadow-sm"
              style={{
                background: "rgba(0, 255, 194, 0.06)",
                border: "1px solid rgba(0, 255, 194, 0.18)",
                color: "#FAFAFA",
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#00FFC2] text-[8px] font-black text-[#0F172A]">
                  Sc
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#00FFC2" }}>
                  Scout
                </span>
              </div>
              <ul className="list-disc pl-4 space-y-1 mt-2 font-medium" style={{ color: "#A1A1AA" }}>
                <li>Strong alignment: {job.tech_stack.slice(0, 2).join(", ")}</li>
                <li>Salary matches your ₹8-14L expectation: ₹{job.pay.min}-{job.pay.max}L</li>
                <li>{job.match_score >= 80 ? "Highly recommended to apply immediately." : "Moderate match on required experience level."}</li>
              </ul>
            </div>
          </section>

          <section>
            <SectionLabel>About the Role</SectionLabel>
            <p className="text-[12.5px] leading-relaxed font-medium" style={{ color: "#A1A1AA" }}>
              {job.description}
            </p>
          </section>

          <section>
            <SectionLabel>Requirements</SectionLabel>
            <ul className="space-y-1.5">
              {job.requirements.map((r, i) => (
                <CheckRow key={i} text={r} />
              ))}
            </ul>
          </section>
            </>
          )}
        </div>

        {/* Footer */}
        <SheetFooter
          className="shrink-0 border-t px-5 py-4"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.4)" }}
        >
          <div className="flex w-full flex-col gap-2">
            <button
              className="w-full rounded-xl py-3 text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98]"
              onClick={handleApply}
              style={{ background: "#00FFC2", color: "#050505" }}
            >
              Copy Quick Intro &amp; Apply
            </button>
            <button
              disabled={isPromoting}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: isPromoting ? "#71717A" : "#FAFAFA",
              }}
              onClick={promoteJobToSerious}
            >
              {isPromoting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Promoting…
                </>
              ) : (
                "🚀 Promote to Serious Mode"
              )}
            </button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

