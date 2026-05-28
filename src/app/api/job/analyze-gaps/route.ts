import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";
import { JobPost } from "@/types/job";
import { Persona } from "@/types/persona";
import personaData from "@/data/me.json";

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { job, persona: personaFromRequest }: { job: JobPost; persona?: Persona } = await req.json();

    // Fall back to local me.json if persona not sent by client
    const persona: Persona = personaFromRequest ?? (personaData as unknown as Persona);

    if (!job || !persona) {
      return NextResponse.json(
        { error: "Job and Persona are required." },
        { status: 400 }
      );
    }

    if (!groq) {
      throw new Error("GROQ_API_KEY is missing");
    }

    // ── Prompt: anti-gatekeeper objection handling ─────────────────────────
    const prompt = `
You are an interview strategist for a Product/Design Engineer.
A candidate (Name: ${persona.name}) is applying for the role: ${job.role} at ${job.company.name}.

Your job is to:
1. Identify 3 to 5 real skill gaps between the candidate's profile and the job requirements.
2. For each identified 'Skill Gap', generate a single, short bullet point explaining how to counter this objection. Emphasize tangible output, UX focus, and high-fidelity prototyping over years of experience.

CRITICAL RULES:
- The target persona is strictly "UX, Product, or Design Engineer".
- Keep the vocabulary simple, short, and punchy.
- You must absolutely NEVER use heavy corporate filler words like "bridging the gap", "synergy", "excited", "passionate", "prospect", or "pleasure".

Return ONLY a JSON object with this exact structure:
{
  "gaps": ["string describing gap 1", "string describing gap 2", ...],
  "objection_strategies": ["objection handling strategy 1", "objection handling strategy 2", ...]
}

Candidate Profile:
Skills: ${JSON.stringify(persona.skills)}
Experience: ${JSON.stringify(persona.experience_details?.map((e) => ({
  role: e.role,
  company: e.company,
  bullets: e.bullets.slice(0, 2),
})))}

Job:
Role: ${job.role} at ${job.company.name}
Tech Stack: ${job.tech_stack.join(", ")}
Requirements: ${job.requirements.join(" | ")}
Match Score: ${job.match_score}%
    `.trim();

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);

    const gaps: string[] = Array.isArray(parsed.gaps) ? parsed.gaps : [];
    const objectionStrategies: string[] = Array.isArray(parsed.objection_strategies)
      ? parsed.objection_strategies
      : [];

    if (gaps.length < 3) {
      throw new Error(
        `Groq returned fewer than 3 gaps (got ${gaps.length}). Re-prompting needed.`
      );
    }

    // ── Cache: write objection_strategies to Supabase ─────────────────────
    const isRealJobId =
      typeof job.id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        job.id
      );

    if (isRealJobId && objectionStrategies.length > 0) {
      const { error: supabaseError } = await supabase
        .from("jobs")
        .update({
          objection_strategies: objectionStrategies,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (supabaseError) {
        console.warn(
          "[analyze-gaps] Supabase cache write failed:",
          supabaseError.message
        );
      }
    }

    return NextResponse.json({ gaps, objection_strategies: objectionStrategies });
  } catch (error) {
    console.error("Error in analyze-gaps:", error);
    return NextResponse.json(
      { error: "Failed to analyze gaps." },
      { status: 500 }
    );
  }
}
