"use client";

import { useState, useCallback } from "react";
import { Loader2, Search, MapPin, Zap } from "lucide-react";
import { toast } from "sonner";
import { JobPost } from "@/types/job";

interface DynamicSearchProps {
  /** Called with the freshly saved job stubs so the grid can prepend them */
  onResults: (jobs: JobPost[]) => void;
}

interface SearchResult {
  jobs: JobPost[];
  total: number;
  message?: string;
}

export function DynamicSearch({ onResults }: DynamicSearchProps) {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!keyword.trim() || isLoading) return;

      setIsLoading(true);
      const toastId = toast.loading(`Scouting "${keyword.trim()}"…`);

      try {
        const res = await fetch("/api/scout/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: keyword.trim(),
            location: location.trim() || "Remote",
          }),
        });

        const data = (await res.json()) as SearchResult;

        if (!res.ok) {
          throw new Error((data as unknown as { error: string }).error || "Search failed");
        }

        const count = data.total ?? data.jobs?.length ?? 0;

        if (count === 0) {
          toast.info(data.message ?? "No new results — all matched existing entries", {
            id: toastId,
          });
        } else {
          toast.success(`${count} new job${count === 1 ? "" : "s"} scouted`, {
            id: toastId,
            description: `"${keyword.trim()}" · ${location.trim() || "Remote"}`,
          });
          onResults(data.jobs ?? []);
          // Also fire the global refresh so Realtime subscribers pick up new rows
          window.dispatchEvent(new Event("scout-refresh"));
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message, { id: toastId });
      } finally {
        setIsLoading(false);
      }
    },
    [keyword, location, isLoading, onResults]
  );

  return (
    <div
      className="mb-5 rounded-xl p-4"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-3">
        <Zap size={11} style={{ color: "var(--mint)" }} />
        <span
          className="text-[10px] font-black uppercase tracking-[0.18em]"
          style={{ color: "var(--text-3)" }}
        >
          Dynamic Search
        </span>
      </div>

      <form onSubmit={handleSearch} className="flex items-stretch gap-2">
        {/* Keyword input */}
        <div className="relative flex-1">
          <Search
            size={12}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-4)" }}
          />
          <input
            id="dynamic-search-keyword"
            type="text"
            placeholder="UX Engineer, React Dev…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
            className="w-full rounded-lg py-2.5 pl-8 pr-3 text-[12.5px] font-medium transition-all focus:outline-none disabled:opacity-40"
            style={{
              background: "var(--surface-3)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-1)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--border-strong)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border-subtle)";
            }}
          />
        </div>

        {/* Location input */}
        <div className="relative w-[160px]">
          <MapPin
            size={12}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-4)" }}
          />
          <input
            id="dynamic-search-location"
            type="text"
            placeholder="Remote, Pune…"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
            className="w-full rounded-lg py-2.5 pl-8 pr-3 text-[12.5px] font-medium transition-all focus:outline-none disabled:opacity-40"
            style={{
              background: "var(--surface-3)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-1)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--border-strong)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border-subtle)";
            }}
          />
        </div>

        {/* Scout Now button */}
        <button
          id="dynamic-search-submit"
          type="submit"
          disabled={isLoading || !keyword.trim()}
          className="flex items-center justify-center gap-1.5 rounded-lg px-5 text-[11px] font-black uppercase tracking-widest transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-20 disabled:cursor-not-allowed"
          style={{
            background: "var(--mint-dim)",
            border: "1px solid rgba(16,185,129,0.25)",
            color: "var(--mint)",
            minWidth: "96px",
          }}
        >
          {isLoading ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <>
              <Zap size={10} />
              Scout
            </>
          )}
        </button>
      </form>
    </div>
  );
}
