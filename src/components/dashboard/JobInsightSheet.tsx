"use client";

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
import { supabase } from "@/lib/supabase";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em]"
      style={{ color: "#94A3B8" }} // Slate-400
    >
      {children}
    </p>
  );
}

function CheckRow({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-[12.5px]" style={{ color: "#475569" }}>
      <span className="mt-0.5 text-[11px]" style={{ color: "#00FFC2" }}>✓</span>
      <span className="leading-relaxed font-medium">{text}</span>
    </li>
  );
}

function buildAISummary(job: JobPost): string {
  const top = job.tech_stack.slice(0, 3).join(", ");
  return (
    `${job.company.name} is looking for a ${job.role} to work ${job.remote_status.toLowerCase()} ` +
    `in their "${job.company.industry}" vertical. Core stack includes ${top}. ` +
    `At ${job.match_score}% alignment with your profile, the biggest gaps are ` +
    (job.match_score < 70
      ? "in tech-stack fit and location preference."
      : "minor — this is a strong apply.") +
    ` Salary range ₹${job.pay.min}–${job.pay.max}L, ${job.experience_level}.`
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

  if (!job) return null;
  const summary = buildAISummary(job);

  const handleApply = () => {
    const quickIntro = `Hi! I'm an engineer passionate about building great products. I scored a ${job.match_score}% match for the ${job.role} position at ${job.company.name} and would love to chat.`;
    navigator.clipboard.writeText(quickIntro);
    toast.success("Quick Intro copied!", {
      description: "Paste it directly into your application.",
    });
    window.open(job.apply_url, "_blank");
  };

  const promoteJobToSerious = async () => {
    const promise = (async () => {
      const { error } = await supabase
        .from("jobs")
        .update({ status: "serious" })
        .eq("id", job.id);
      if (error) throw error;
    })();

    toast.promise(promise, {
      loading: "Moving to Serious Mode...",
      success: () => {
        onClose();
        router.push("/dashboard/serious");
        return "Added to your Queue!";
      },
      error: "Failed to update status.",
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        className="flex flex-col outline-none w-[90vw] max-w-[440px] p-0 sm:max-w-[440px]"
        style={{
          background: "#FFFFFF",
          borderLeft: "1px solid #E2E8F0",
        }}
      >
        {/* Header */}
        <SheetHeader className="border-b px-5 py-4 shrink-0 text-left" style={{ borderColor: "#E2E8F0" }}>
          <div>
            <SheetDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {job.company.name} · {job.company.industry}
            </SheetDescription>
            <SheetTitle className="text-lg font-bold leading-snug mt-0.5 text-slate-900">
              {job.role}
            </SheetTitle>
            <p className="mt-1 text-xs font-semibold text-slate-600">
              {job.remote_status} · {job.location} · ₹{job.pay.min}–{job.pay.max}L
            </p>
          </div>
        </SheetHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* AI Distilled Summary (3 bullets conceptually, or short paragraph) */}
          <section>
            <SectionLabel>AI-Distilled Insight</SectionLabel>
            <div
              className="rounded-lg p-3.5 text-[12.5px] leading-relaxed font-semibold shadow-sm"
              style={{
                background: "rgba(0, 255, 194, 0.08)",
                border: "1px solid rgba(0, 255, 194, 0.2)",
                color: "#1E293B",
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#00FFC2] text-[8px] font-black text-[#0F172A]">
                  Sc
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#047857]">
                  Scout
                </span>
              </div>
              <ul className="list-disc pl-4 space-y-1 mt-2 text-slate-700 font-medium">
                <li>Strong alignment: {job.tech_stack.slice(0, 2).join(", ")}</li>
                <li>Salary matches your ₹8-14L expectation: ₹{job.pay.min}-{job.pay.max}L</li>
                <li>{job.match_score >= 80 ? "Highly recommended to apply immediately." : "Moderate match on required experience level."}</li>
              </ul>
            </div>
          </section>

          <section>
            <SectionLabel>About the Role</SectionLabel>
            <p className="text-[12.5px] leading-relaxed font-medium text-slate-600">
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
        </div>

        {/* Footer */}
        <SheetFooter className="shrink-0 border-t px-5 py-4" style={{ borderColor: "#E2E8F0" }}>
          <div className="flex w-full flex-col gap-2">
            <Button
              size="lg"
              className="w-full text-sm font-bold shadow-sm hover:scale-[0.99] transition-transform"
              onClick={handleApply}
              style={{ background: "#0F172A", color: "#FBFBFB" }}
            >
              Copy Quick Intro & Apply
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full text-sm font-bold"
              style={{ background: "#F1F5F9", borderColor: "#E2E8F0", color: "#475569" }}
              onClick={promoteJobToSerious}
            >
              Promote to Serious Mode
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
