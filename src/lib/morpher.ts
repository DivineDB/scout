"use server";

import { Persona, MorphedProfile, ExperienceDetail } from "@/types/persona";
import { JobPost } from "@/types/job";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function morphResume(persona: Persona, job: JobPost): Promise<MorphedProfile> {
  // 1. Prepare the prompt to analyze the Technical Theme and prioritize
  const prompt = `
    You are an expert technical recruiter and resume writer.
    Your task is to analyze the following Job Description (JD) and Persona.
    
    1. Identify the 'Technical Theme' of the JD. Is it primarily about 'Performance', 'Scale', 'UX', 'AI Integration', or something else?
    2. Review the persona's experience details (projects/roles).
    3. Reorder the experience_details array to prioritize the project/role that BEST represents the identified Technical Theme at the top.
    4. Within each experience, reorder the bullets to prioritize those that match the JD's top tech stack.

    Return the result strictly as a valid JSON matching this structure:
    {
      "top_keywords": ["keyword1", "keyword2", ... (up to 5 keywords from JD tech stack)],
      "morphed_experience": [
        {
          "role": "...",
          "company": "...",
          "duration": "...",
          "bullets": ["...", "...", "..."]
        },
        ...
      ]
    }

    Job Role: ${job.role}
    Job Tech Stack: ${job.tech_stack.join(", ")}
    Job Description: ${job.description}

    Persona Experience JSON:
    ${JSON.stringify(persona.experience_details, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            top_keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            morphed_experience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING },
                  company: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  bullets: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ["role", "company", "duration", "bullets"],
              },
            },
          },
          required: ["top_keywords", "morphed_experience"],
        },
      },
    });

    if (!response.text) {
      throw new Error("No output from Gemini for morpher.");
    }

    const result = JSON.parse(response.text);

    return {
      persona,
      target_job_title: job.role,
      top_keywords: result.top_keywords,
      morphed_experience: result.morphed_experience,
    };
  } catch (err) {
    console.error("Error morphing resume:", err);
    // Fallback to naive logic if LLM fails
    const topKeywords = job.tech_stack.slice(0, 5).map(k => k.toLowerCase());
    const fallbackExp: ExperienceDetail[] = persona.experience_details.map(exp => {
      const scoredBullets = exp.bullets.map(bullet => {
        let matchCount = 0;
        topKeywords.forEach(keyword => {
          if (bullet.toLowerCase().includes(keyword)) matchCount++;
        });
        return { bullet, matchCount };
      });
      scoredBullets.sort((a, b) => b.matchCount - a.matchCount);
      return { ...exp, bullets: scoredBullets.map(sb => sb.bullet) };
    });

    return {
      persona,
      target_job_title: job.role,
      top_keywords: job.tech_stack.slice(0, 5),
      morphed_experience: fallbackExp,
    };
  }
}
