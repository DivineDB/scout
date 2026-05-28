import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";
import { JobPost } from "@/types/job";
import { Persona } from "@/types/persona";
import type { OutreachChannel } from "@/types/job";
import personaData from "@/data/me.json";

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Channel-specific system prompts ───────────────────────────────────────────
function buildChannelPrompt(
  channel: OutreachChannel,
  job: JobPost,
  persona: Persona
): string {
  const stackSnippet = job.tech_stack.slice(0, 4).join(", ");
  const topProject = persona.experience_details?.[0];
  const projectBlurb = topProject
    ? `${topProject.role} at ${topProject.company} (${topProject.duration})`
    : "recent product engineering project";

  const criticalRules = `
CRITICAL RULES:
- The target persona is strictly "UX, Product, or Design Engineer".
- Keep the vocabulary simple, short, and punchy.
- You must absolutely NEVER use heavy corporate filler words like "bridging the gap", "synergy", "excited", "passionate", "prospect", or "pleasure".
`;

  const channelInstructions: Record<OutreachChannel, string> = {
    email: `Write a 3-sentence cold email to a founder. Be short and direct. Focus strictly on UX, product design, and engineering execution. State exactly what you build, map a specific project to their tech stack, and ask if they want to see a live link. No greetings (e.g., 'Hi', 'Dear').`,
    
    linkedin: `Write a 2-sentence connection request (max 250 chars). Ultra-short. No fluff. Focus purely on a shared interest in UI/UX or product engineering.`,
    
    twitter: `Write a 1-sentence Twitter DM. Ultra-casual, lowercase is okay. Focus on a specific UX or product detail they recently shipped or are hiring for.`
  };

  return `You are generating outreach for the candidate:
Name: ${persona.name}
Top project: ${projectBlurb}
Target Job: ${job.role} at ${job.company.name}
Job Tech Stack: ${job.tech_stack.join(", ")}
Job Requirements (top 3): ${job.requirements.slice(0, 3).join(" | ")}

${criticalRules}

Instruction for this channel:
${channelInstructions[channel]}

Return ONLY a JSON object:
{ "hook": "string with the outreach text" }`;
}

export async function POST(req: Request) {
  try {
    const {
      job,
      persona: personaFromRequest,
      channel = "email",
    }: { job: JobPost; persona?: Persona; channel?: OutreachChannel } =
      await req.json();

    // Fall back to local me.json if persona not sent by client
    const persona: Persona = personaFromRequest ?? (personaData as unknown as Persona);

    if (!job || !persona) {
      return NextResponse.json(
        { error: "Job and Persona are required." },
        { status: 400 }
      );
    }

    const validChannels: OutreachChannel[] = ["email", "linkedin", "twitter"];
    if (!validChannels.includes(channel)) {
      return NextResponse.json(
        { error: `Invalid channel. Must be one of: ${validChannels.join(", ")}` },
        { status: 400 }
      );
    }

    if (!groq) {
      throw new Error("GROQ_API_KEY is missing");
    }

    const prompt = buildChannelPrompt(channel, job, persona);

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.65,
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);

    if (!parsed.hook) {
      throw new Error("No hook generated from Groq.");
    }

    const hook = String(parsed.hook).trim();

    // ── Cache: patch outreach_hooks[channel] in Supabase ──────────────────
    // Only patch if we have a real DB job (UUID format) — skip mocks
    const isRealJobId =
      typeof job.id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        job.id
      );

    if (isRealJobId) {
      // Merge into existing outreach_hooks object using JSONB concat
      const { error: supabaseError } = await supabase
        .from("jobs")
        .update({
          outreach_hooks: {
            ...(job.outreach_hooks ?? {}),
            [channel]: hook,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (supabaseError) {
        // Non-fatal: log and continue — hook is still returned to client
        console.warn("[generate-hook] Supabase cache write failed:", supabaseError.message);
      }
    }

    return NextResponse.json({ hook, channel });
  } catch (error) {
    console.error("Error generating hook:", error);
    return NextResponse.json(
      {
        error: `Hook generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
