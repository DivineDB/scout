import * as cheerio from 'cheerio';
import { GoogleGenAI, Type } from '@google/genai';
import type { JobPost } from '../types/job';
import FirecrawlApp from '@mendable/firecrawl-js';
import meData from '../data/me.json';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY || 'missing' });

/**
 * Scrapes raw text content from a given URL to be processed by our Distiller.
 */
export async function fetchJobPage(url: string): Promise<string> {
  if (!process.env.FIRECRAWL_API_KEY || process.env.FIRECRAWL_API_KEY.includes('YOUR_API_KEY')) {
    throw new Error('FIRECRAWL_API_KEY is missing or invalid. Please update .env.local');
  }

  try {
    const result = await firecrawl.scrape(url, { formats: ['markdown'], timeout: 30000 });
    if (!result.markdown) {
      console.warn("Firecrawl returned empty markdown.");
    }
    return result.markdown?.substring(0, 15000) || '';
  } catch (err) {
    console.error('Failed to fetch job page via Firecrawl:', err);
    throw new Error('Could not scrape job page. Ensure the URL is valid and accessible.');
  }
}

/**
 * Perform a simple search for company intelligence
 */
export async function fetchCompanyIntel(companyName: string) {
  try {
    // We'll search DuckDuckGo html version for basic text snippets if available
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
      `site:glassdoor.com OR site:ambitionbox.com ${companyName} reviews culture`
    )}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const snippets: string[] = [];
    $('.result__snippet').each((i, el) => {
      snippets.push($(el).text().trim());
    });

    return snippets.join('\n');
  } catch (err) {
    console.error('Failed to fetch company intel:', err);
    return ""; // Soft fail
  }
}

/**
 * The Distiller Agent: analyzes raw HTML/text and company intel to generate a structured job post.
 */
export async function distillJobData(rawText: string, companyIntel: string): Promise<Omit<JobPost, 'id' | 'is_active' | 'created_at' | 'updated_at'>> {
  const prompt = `
    Analyze the following raw text from a job posting and company intelligence search snippets.
    Extract the requested details and format them strictly.

    Generate a 3-bullet AI summary for the "description".
    Provide salary uniformly in INR LPA (e.g. min/max). If salary is missing, make a realistic guess based on role and experience.
    Make sure to integrate culture rating, top pro, and top con (from the company intel if available, or realistically hypothesize if snippets are sparse).
    Ensure the tech stack array is very precise.

    Use strict BAML-style data extraction: only output valid JSON conforming exactly to the requested schema. No markdown wrapping.
    
    You also have context about the user whose profile you are evaluating against:
    User Profile Context:
    ${JSON.stringify(meData, null, 2)}

    Determine a match_score (0-100) based on the user's profile context vs the job requirements.
    Write a 1-sentence match_explanation explaining the score.
    List any missing_skills (tech stack skills in the JD that the user profile explicitly lacks).

    Raw Job Post Text:
    ${rawText}

    Company Intel Snippets:
    ${companyIntel}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          company: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              website: { type: Type.STRING },
              size: { type: Type.STRING, enum: ["Startup", "Mid-size", "Large", "Enterprise"] },
              industry: { type: Type.STRING },
            },
            required: ["name", "size", "industry"],
          },
          role: { type: Type.STRING },
          experience_level: { type: Type.STRING, enum: ["Internship", "Entry-level", "Mid-level", "Senior", "Lead", "Principal"] },
          job_type: { type: Type.STRING, enum: ["Full-time", "Part-time", "Contract", "Freelance"] },
          pay: {
            type: Type.OBJECT,
            properties: {
              min: { type: Type.NUMBER },
              max: { type: Type.NUMBER },
              currency: { type: Type.STRING },
            },
            required: ["min", "max"],
          },
          remote_status: { type: Type.STRING, enum: ["Remote", "Hybrid", "On-site"] },
          location: { type: Type.STRING },
          tech_stack: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          match_score: { type: Type.INTEGER, description: "Calculate a match score between 0 and 100 based on standard tech stacks. Let's assume a generic dev profile for now." },
          match_explanation: { type: Type.STRING, description: "1-sentence reason for the match score" },
          missing_skills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tags in the JD but missing from the user's skills" },
          description: { type: Type.STRING, description: "3-bullet AI summary of the role including the culture rating, top pro, and top con." },
          responsibilities: { type: Type.ARRAY, items: { type: Type.STRING } },
          requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
          apply_url: { type: Type.STRING, description: "The application link if found" },
          posted_at: { type: Type.STRING, description: "ISO 8601 date, default to today if unknown" },
          apply_by: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          "company", "role", "experience_level", "job_type", "pay", 
          "remote_status", "location", "tech_stack", "match_score", 
          "match_explanation", "missing_skills",
          "description", "responsibilities", "requirements", "apply_url",
          "posted_at", "tags"
        ],
      },
    },
  });

  if (!response.text) {
    throw new Error("Failed to distill data from Gemini.");
  }

  const parsedData = JSON.parse(response.text);

  // ── Soft validation: fill match_explanation if missing instead of crashing ──
  if (
    !parsedData.match_explanation ||
    typeof parsedData.match_explanation !== "string" ||
    parsedData.match_explanation.trim().length === 0
  ) {
    console.warn("[Distiller] match_explanation was empty — filling with fallback.");
    parsedData.match_explanation = `${parsedData.match_score ?? 0}% match based on tech stack alignment.`;
  }

  return parsedData;
}
