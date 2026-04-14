"use server";

import { Persona, MorphedProfile, ExperienceDetail } from "@/types/persona";
import { JobPost } from "@/types/job";
import Groq from "groq-sdk";

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

export async function morphResume(persona: Persona, job: JobPost): Promise<MorphedProfile> {
  // Fallback to naive logic if LLM is unavailable
  const runFallback = () => {
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
  };

  if (!groq) {
    console.warn("GROQ_API_KEY not set, using fallback morpher logic");
    return runFallback();
  }

  const prompt = `
    You are an expert technical recruiter and resume writer.
    Your task is to analyze the following Job Description (JD) and Persona.
    
    1. Identify the 'Technical Theme' of the JD. Is it primarily about 'Performance', 'Scale', 'UX', 'AI Integration', or something else?
    2. Review the persona's experience details (projects/roles).
    3. Reorder the experience_details array to prioritize the project/role that BEST represents the identified Technical Theme at the top.
    4. Within each experience, rewrite and tailor the bullets to heavily emphasize how the past experience maps to the JD's stack and requirements. You MUST rewrite the descriptions slightly to make them sound like a perfect match without modifying the factual nature of the roles. Reorder the newly tailored bullets to prioritize the best matching ones at the top.

    Return the result strictly as a valid JSON matching this exact structure:
    {
      "top_keywords": ["keyword1", "keyword2"],
      "morphed_experience": [
        {
          "role": "string",
          "company": "string",
          "duration": "string",
          "bullets": ["string", "string"]
        }
      ]
    }

    Job Role: ${job.role}
    Job Tech Stack: ${job.tech_stack.join(", ")}
    Job Description: ${job.description}

    Persona Experience JSON:
    ${JSON.stringify(persona.experience_details, null, 2)}
  `;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(text);

    return {
      persona,
      target_job_title: job.role,
      top_keywords: result.top_keywords || job.tech_stack.slice(0, 5),
      morphed_experience: result.morphed_experience || persona.experience_details,
    };
  } catch (err) {
    console.error("Error morphing resume:", err);
    return runFallback();
  }
}
