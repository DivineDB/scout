import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { JobPost } from "@/types/job";
import { Persona } from "@/types/persona";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { job, persona }: { job: JobPost; persona: Persona } = await req.json();

    if (!job || !persona) {
      return NextResponse.json(
        { error: "Job and Persona are required." },
        { status: 400 }
      );
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

      Persona Experience (pick the most relevant project, do not invent new ones):
      ${JSON.stringify(persona.experience_details, null, 2)}

      Output ONLY the hook text. No greeting, no sign-off, no subject line.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        maxOutputTokens: 180,
        temperature: 0.6,
      },
    });

    if (!response.text) {
      throw new Error("No output generated from Gemini.");
    }

    const hook = response.text.replace(/^"|"$/g, "").trim();

    return NextResponse.json({ hook });
  } catch (error) {
    console.error("Error generating hook:", error);
    return NextResponse.json(
      { error: "Failed to generate hook." },
      { status: 500 }
    );
  }
}
