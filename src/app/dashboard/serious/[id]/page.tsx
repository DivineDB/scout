"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { JobPost } from "@/types/job";
import { Persona } from "@/types/persona";
import { morphResume } from "@/lib/morpher";
import { ResumeTemplate } from "@/components/ResumeTemplate";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import meData from "@/data/me.json";

const PDFViewer = dynamic(() => import("@react-pdf/renderer").then(m => m.PDFViewer), { ssr: false });
const PDFDownloadLink = dynamic(() => import("@react-pdf/renderer").then(m => m.PDFDownloadLink), { ssr: false });

export default function SeriousModePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const id = use(params).id;
  const [job, setJob] = useState<JobPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const persona = meData as Persona;

  useEffect(() => {
    async function fetchJob() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        setJob(data as JobPost);
      } catch (err) {
        console.error("Error fetching job:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchJob();
  }, [id]);

  if (isLoading) return (
    <div className="flex h-screen w-full items-center justify-center bg-[#FAFAFA]">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
    </div>
  );

  if (!job) return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#FAFAFA] gap-4">
      <p className="font-bold text-slate-900 text-lg">Job Not Found</p>
      <p className="text-slate-500 -mt-2 text-sm">This job may have been removed or the ID is invalid.</p>
      <Button 
        onClick={() => router.push("/dashboard/serious")}
        className="mt-2 bg-slate-900 text-white"
      >
        Return to Serious Queue
      </Button>
    </div>
  );

  const morphedProfile = morphResume(persona, job);

  return (
    <div className="flex h-screen w-full bg-[#FAFAFA] overflow-hidden text-slate-800">
      {/* LEFT PANE: JOB DETAILS */}
      <div className="w-1/3 min-w-[360px] max-w-[420px] border-r border-[#E2E8F0] bg-white flex flex-col shadow-sm z-10">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4 text-slate-700" />
          </Button>
          <span className="font-bold text-sm tracking-wide text-slate-800">SERIOUS MODE</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
              {job.company.name}
            </p>
            <h1 className="text-xl font-black leading-tight text-slate-900 mb-2">
              {job.role}
            </h1>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600 mb-4">
              <span className="px-2 py-0.5 bg-slate-100 rounded-sm">{job.remote_status}</span>
              <span className="px-2 py-0.5 bg-slate-100 rounded-sm">₹{job.pay.min}-{job.pay.max}L</span>
              <span className="px-2 py-0.5 bg-slate-100 rounded-sm">{job.experience_level}</span>
            </div>
            <p className="text-[13px] leading-relaxed font-medium text-slate-600">
              {job.description}
            </p>
          </div>

          <div>
             <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
               Core Tech Stack
             </p>
             <div className="flex flex-wrap gap-1.5">
               {job.tech_stack.map(tech => (
                 <span key={tech} className="px-2 py-1 text-[11px] font-bold bg-[#00FFC2]/10 text-[#047857] rounded-sm">
                   {tech}
                 </span>
               ))}
             </div>
          </div>
        </div>

        <div className="p-5 border-t border-[#E2E8F0] bg-slate-50">
          <PDFDownloadLink
            document={<ResumeTemplate profile={morphedProfile} />}
            fileName={`Resume_${persona.name.replace(' ', '_')}_${job.company.name.replace(' ', '_')}.pdf`}
          >
            {/* Using a styled div as child per Carbon Mint instructions */}
            <div
              className="w-full py-3.5 rounded-md text-[13px] font-bold flex items-center justify-center cursor-pointer shadow-md transition-transform hover:scale-[0.99] font-sans"
              style={{ background: "#0F172A", color: "#00FFC2", border: "1px solid #00FFC2", letterSpacing: "0.5px" }}
            >
              DOWNLOAD TAILORED PDF
            </div>
          </PDFDownloadLink>
        </div>
      </div>

      {/* RIGHT PANE: PDF PREVIEW */}
      <div className="flex-1 bg-[#F1F5F9] p-6 flex flex-col h-full">
         <div className="mb-4 flex flex-col gap-1">
           <h2 className="text-lg font-black text-slate-900 tracking-tight">Live ATS Preview</h2>
           <p className="text-[12px] font-medium text-slate-500">
             Serious engine prioritized: <span className="font-bold text-[#047857]">{morphedProfile.top_keywords.join(', ')}</span>
           </p>
         </div>
         <div className="flex-1 rounded-xl border border-slate-300 shadow-lg overflow-hidden bg-white">
            <PDFViewer style={{ width: "100%", height: "100%", border: "none" }}>
              <ResumeTemplate profile={morphedProfile} />
            </PDFViewer>
         </div>
      </div>
    </div>
  );
}
