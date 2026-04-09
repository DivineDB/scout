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
      You are an expert, direct, and pragmatic software engineer named ${persona.name}.
      Write a 2-sentence cold hook to the hiring team at ${job.company.name} for the role of ${job.role}.

      CRITICAL CONSTRAINTS:
      1. Length MUST be EXACTLY 2 sentences. No less, no more.
      2. FORBIDDEN WORDS: passionate, leverage, thrilled, unique, synergy, delve, navigate, testament, landscape. Do NOT use these "AI-isms".
      3. Sentence 1: Start with a technical observation about ${job.company.name}'s stack, product, or industry (${job.company.industry}).
      4. Sentence 2: Link this observation to a specific problem you solved in one of your projects (pick one from the persona data below) and your core technical skills matching the JD.

      Persona Experience:
      ${JSON.stringify(persona.experience_details)}

      Job Tech Stack:
      ${job.tech_stack.join(", ")}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        maxOutputTokens: 100,
        temperature: 0.4,
      },
    });

    if (!response.text) {
      throw new Error("No output generated from Gemini.");
    }

    // Quick cleanup just in case there are quotes or extra lines
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
