import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { supabaseAdmin } from "@/lib/supabase";

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

export async function POST(req: Request) {
  try {
    const {
      jobId,
      jobDescription,
      requiredTech = [],
    }: { jobId: string; jobDescription: string; requiredTech?: string[] } =
      await req.json();

    if (!jobId || !jobDescription) {
      return NextResponse.json(
        { error: "jobId and jobDescription are required." },
        { status: 400 }
      );
    }

    if (!groq) {
      throw new Error("GROQ_API_KEY is missing");
    }

    // 1. Fetch all portfolio assets from database
    const { data: portfolioAssets, error: dbError } = await supabaseAdmin
      .from("portfolio_assets")
      .select("*");

    if (dbError || !portfolioAssets || portfolioAssets.length === 0) {
      console.error("[map-portfolio] Failed to fetch assets:", dbError);
      throw new Error(
        "Could not load portfolio assets from the database. Make sure portfolio_assets is seeded."
      );
    }

    // 2. Build Groq prompt
    const prompt = `
You are an expert UX/UI Design Engineer and Full-Stack Career Strategist.
Your goal is to map the most relevant projects from your portfolio inventory to a target job description.

Inventory of Available Projects:
${JSON.stringify(
  portfolioAssets.map((asset) => ({
    name: asset.project_name,
    tech: asset.tech_stack,
    ux: asset.ux_focus,
    tech_summary: asset.technical_summary,
  }))
)}

Target Job:
Description Snippet: ${jobDescription.substring(0, 1500)}
Preferred Tech Stack: ${requiredTech.join(", ")}

Task:
Pick EXACTLY the 2 most relevant projects from the inventory that align best with the target job.
For each project, write a single-sentence technical justification explaining why it fits this specific role.

CRITICAL RULES:
- The target persona is strictly "UX, Product, or Design Engineer".
- You must absolutely NEVER use heavy corporate filler words like "bridging the gap", "synergy", "excited to present", "passion", "leverage", or "pleasure".
- Keep the justification simple, conversational, short, and highly technical. Focus strictly on UX, design, and engineering output.
- Output ONLY a JSON array matching this exact structure:
[
  {
    "project_name": "Name of project chosen",
    "justification": "Exactly one sentence of simple, conversational, punchy technical justification."
  }
]
`.trim();

    // 3. Invoke Groq SDK with llama-3.3-70b-specdec model
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-specdec",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }, // Wait, JSON array is valid in json_object when wrapped or we can parse it
      temperature: 0.2,
    });

    const contentText = response.choices[0]?.message?.content ?? "[]";
    let mappedResult = [];
    try {
      const parsed = JSON.parse(contentText);
      // Handle cases where the LLM wraps the array inside an object key
      if (Array.isArray(parsed)) {
        mappedResult = parsed;
      } else if (parsed.projects && Array.isArray(parsed.projects)) {
        mappedResult = parsed.projects;
      } else if (parsed.mapping && Array.isArray(parsed.mapping)) {
        mappedResult = parsed.mapping;
      } else {
        // Fallback: extract any array values or form an array
        const values = Object.values(parsed);
        if (values.length === 1 && Array.isArray(values[0])) {
          mappedResult = values[0];
        } else {
          // If it's a single object instead of array
          if (parsed.project_name && parsed.justification) {
            mappedResult = [parsed];
          } else {
            throw new Error("Invalid output format from Groq");
          }
        }
      }
    } catch (parseError) {
      console.error("[map-portfolio] Parse error on raw output:", contentText, parseError);
      throw new Error("Failed to parse AI output. Raw text was: " + contentText);
    }

    // Ensure it has exactly the chosen fields and cap at 2
    const cleanMapping = mappedResult.slice(0, 2).map((item: any) => ({
      project_name: String(item.project_name || "").trim(),
      justification: String(item.justification || "").trim(),
    }));

    // 4. Instantly patch jobs table status in Supabase using the service role key
    const isRealJobId =
      typeof jobId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        jobId
      );

    if (isRealJobId && cleanMapping.length > 0) {
      const { error: patchError } = await supabaseAdmin
        .from("jobs")
        .update({
          portfolio_mapping: cleanMapping,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (patchError) {
        console.error("[map-portfolio] Supabase patch error:", patchError);
      }
    }

    return NextResponse.json(cleanMapping);
  } catch (error: any) {
    console.error("[map-portfolio] Service error:", error);
    return NextResponse.json(
      {
        error: `Portfolio mapping failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
