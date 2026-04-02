import { Persona, MorphedProfile, ExperienceDetail } from "@/types/persona";
import { JobPost } from "@/types/job";

export function morphResume(persona: Persona, job: JobPost): MorphedProfile {
  // 1. Identify top 5 technical keywords from the job's tech stack
  const topKeywords = job.tech_stack.slice(0, 5).map(k => k.toLowerCase());

  // 2. Reorder experience bullets to prioritize matching keywords
  const morphedExp: ExperienceDetail[] = persona.experience_details.map(exp => {
    // Score bullets based on how many topKeywords they contain
    const scoredBullets = exp.bullets.map(bullet => {
      const bulletLower = bullet.toLowerCase();
      let matchCount = 0;
      topKeywords.forEach(keyword => {
        if (bulletLower.includes(keyword)) {
          matchCount++;
        }
      });
      return { bullet, matchCount };
    });

    // Sort descending by matchCount
    scoredBullets.sort((a, b) => b.matchCount - a.matchCount);

    return {
      ...exp,
      bullets: scoredBullets.map(sb => sb.bullet),
    };
  });

  return {
    persona,
    target_job_title: job.role,
    top_keywords: job.tech_stack.slice(0, 5),
    morphed_experience: morphedExp,
  };
}
