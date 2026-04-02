"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

export function ScoutInput() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleScout(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;

    try {
      setIsLoading(true);
      toast.loading("Scouting job post...", { id: "scout-toast" });

      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server Busy: An unexpected error occurred.");
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to scout job");
      }

      toast.success("Job successfully scouted and saved!", { id: "scout-toast" });
      setUrl("");
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message, { id: "scout-toast" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleScout} className="mb-6 flex w-full max-w-xl items-center gap-2">
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="url"
          placeholder="Paste URL to manually scout..."
          className="block w-full rounded-full border-0 py-2.5 pl-10 pr-4 text-sm tracking-tight text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 transition-shadow placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-slate-900 bg-white/50 backdrop-blur-md hover:bg-white"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !url}
        className="flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold tracking-tight text-white shadow-sm ring-1 ring-inset ring-slate-900 transition-all hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Scouting...
          </>
        ) : (
          "Scout"
        )}
      </button>
    </form>
  );
}
