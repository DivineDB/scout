import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
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
      You are a senior technical hiring manager. Analyze why the following candidate's profile
      does NOT fully match the job requirements. The match score is ${job.match_score}% (below 70%).

      Your task: List at least 3 specific gaps — these must be concrete missing skills, seniority 
      requirements, or domain knowledge from the JD that the candidate's profile does NOT demonstrate.
      
      Be precise. Examples of good gaps:
      - "No production experience with Kubernetes or container orchestration"
      - "Missing 2+ years of backend Go/Rust systems programming"
      - "No demonstrated experience with ML model deployment to production"
      
      RULES:
      - List ONLY gaps, not matches
      - Each gap must be 1 sentence max
      - At least 3 gaps, at most 6
      - Do NOT use generic phrases like "lacks experience" without specifics

      Candidate Profile:
      Name: ${persona.name}
      Skills: ${JSON.stringify(persona.skills)}
      Experience: ${JSON.stringify(persona.experience_details)}

      Job Requirements:
      Role: ${job.role} at ${job.company.name}
      Tech Stack: ${job.tech_stack.join(", ")}
      Requirements: ${job.requirements.join(" | ")}
      Match Score: ${job.match_score}%
    `;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-pro",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gaps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "A list of 3-6 specific missing requirements or skill gaps",
            },
          },
          required: ["gaps"],
        },
      },
    });

    if (!response.text) {
      throw new Error("No output from Gemini.");
    }

    const parsed = JSON.parse(response.text);
    const gaps: string[] = parsed.gaps ?? [];

    // Enforce minimum 3 items
    if (gaps.length < 3) {
      throw new Error(`Gemini returned fewer than 3 gaps (got ${gaps.length}). Re-prompting needed.`);
    }

    return NextResponse.json({ gaps });
  } catch (error) {
    console.error("Error in analyze-gaps:", error);
    return NextResponse.json(
      { error: "Failed to analyze gaps." },
      { status: 500 }
    );
  }
}
