import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { JobPost } from "@/types/job";
import { Persona } from "@/types/persona";

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

export async function POST(req: Request) {
  try {
    const { job, persona }: { job: JobPost; persona: Persona } = await req.json();

    if (!job || !persona) {
      return NextResponse.json(
        { error: "Job and Persona are required." },
        { status: 400 }
      );
    }

    if (!groq) {
      throw new Error("GROQ_API_KEY is missing");
    }

    const prompt = `
      You are ${persona.name}, a sharp full-stack engineer and CS grad (${persona.graduation_year}).
      Write a 3-sentence technical intro as a cold outreach hook to the hiring team at ${job.company.name} for the ${job.role} position.

      CORE RULE — Evidence over Enthusiasm:
      - Be direct and specific. Do not use corporate buzzwords. No fluff.
      - FORBIDDEN WORDS: passionate, leverage, thrilled, excited, unique, synergy, delve, navigate, testament, landscape, hard-working, team player. Do NOT use any of these.

      STRUCTURE (must follow):
      1. Open with a sharp, specific technical observation about ${job.company.name}'s product, stack (${job.tech_stack.slice(0, 4).join(", ")}), or the ${job.company.industry} domain.
      2. Reference a specific project (e.g., POS system, Crawler, or Kindly.ai) as it relates to the JD and connect it to a concrete problem you solved.
      3. Close with one crisp sentence on why this role is the logical next move for you technically.
      
      Return ONLY a JSON object exactly like this:
      {
        "hook": "string representing the outreach hook"
      }

      Persona Experience (pick the most relevant project, do not invent new ones):
      ${JSON.stringify(persona.experience_details, null, 2)}
    `;

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);
    
    if (!parsed.hook) {
      throw new Error("No output generated from Groq.");
    }

    const hook = String(parsed.hook).trim();

    return NextResponse.json({ hook });
  } catch (error) {
    console.error("Error generating hook:", error);
    return NextResponse.json(
      { error: `Mock test failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
