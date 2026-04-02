import { JobGrid } from "@/components/dashboard/JobGrid";
import { ScoutInput } from "@/components/dashboard/ScoutInput";

export default function CasualHuntPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10 md:py-12">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          Casual Hunt 🎣
        </h1>
        <p className="text-sm font-semibold text-slate-500">
          Swipe through matches. Copy quick intro, apply, next.
        </p>
      </header>
      
      <ScoutInput />
      
      <JobGrid />
    </div>
  );
}
