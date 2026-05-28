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

			toast.success("Job successfully scouted and saved!", {
				id: "scout-toast",
			});
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
		<form
			onSubmit={handleScout}
			className="flex items-center gap-1.5 w-full sm:w-[260px] md:w-[320px] shrink-0"
		>
			<div className="relative flex-1">
				<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
					<Search className="h-3 w-3 text-foreground/30" />
				</div>
				<input
					type="url"
					placeholder="Paste job URL..."
					className="block w-full rounded-md border border-white/5 bg-white/[0.02] h-8 pl-8 pr-2 text-[11px] tracking-tight transition-all focus:border-white/20 focus:outline-none focus:ring-0"
					style={{
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
				className="flex items-center justify-center gap-1.5 rounded-md px-3 h-8 text-[10px] font-black uppercase tracking-widest transition-all bg-foreground text-background hover:opacity-90 active:scale-[0.98] disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
			>
				{isLoading ? (
					<>
						<Loader2 className="h-3 w-3 animate-spin" />
						Scouting...
					</>
				) : (
					"Scout"
				)}
			</button>
		</form>
	);
}
