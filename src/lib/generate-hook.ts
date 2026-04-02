import { JobPost } from "@/types/job";
import personaData from "@/data/me.json";

export interface PersonaProfile {
  name: string;
  degree: string;
  graduation_year: number;
  experience: {
    internships: number;
    personal_projects: number;
  };
  skills: {
    languages: string[];
    frameworks: string[];
    ai_ml: string[];
  };
}

export function generateSeriousHuntHook(
  job: JobPost,
  persona: PersonaProfile = personaData as unknown as PersonaProfile
): string {
  // A deterministic logic building a 2-sentence hook bridging the user's best skills to the job domain
  
  const techIntersect = job.tech_stack.find((t) =>
    persona.skills.languages.includes(t) || 
    persona.skills.frameworks.includes(t) ||
    persona.skills.ai_ml.includes(t)
  );

  const anchorSkill = techIntersect || persona.skills.frameworks[0];
  const domain = job.company.industry || "innovative tech";

  // Sentence 1: Hard impact and relevance
  const s1 = `I am a ${persona.graduation_year} CS grad with proven full-stack and UI/UX experience, deeply interested in ${job.company.name}'s mission within ${domain}.`;
  
  // Sentence 2: Specific stack value
  const s2 = `My hands-on background building with ${anchorSkill} specifically aligns with your ${job.role} needs, allowing me to ship clean, performant features from day one.`;

  return `${s1} ${s2}`;
}
