import { JobGrid } from "@/components/dashboard/JobGrid";
import { ScoutInput } from "@/components/dashboard/ScoutInput";
import { FilterBar } from "@/components/FilterBar";

export default function CasualHuntPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      {/* Sticky Filter Bar */}
      <FilterBar />

      {/* Page Content */}
      <div className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10 md:py-10">
        <header className="mb-6 flex flex-col gap-1">
          <h1
            className="text-2xl font-black tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            Casual Hunt 🎣
          </h1>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--muted-foreground)" }}
          >
            Ghost scouts while you sleep. Swipe through matches, apply fast.
          </p>
        </header>

        <ScoutInput />
        <JobGrid />
      </div>
    </div>
  );
}
