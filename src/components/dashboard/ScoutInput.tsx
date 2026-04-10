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
      window.dispatchEvent(new Event("scout-refresh"));
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
          <Search className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
        </div>
        <input
          type="url"
          placeholder="Paste job URL to scout..."
          className="block w-full rounded-full py-2.5 pl-10 pr-4 text-sm tracking-tight transition-all focus:outline-none focus:ring-2"
          style={{
            background: "var(--card)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "var(--foreground)",
          }}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !url}
        className="flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold tracking-tight transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "#00FFC2", color: "#050505" }}
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
