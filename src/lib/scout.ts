import * as cheerio from 'cheerio';
import Groq from 'groq-sdk';
import type { JobPost } from '../types/job';
import FirecrawlApp from '@mendable/firecrawl-js';
import meData from '../data/me.json';

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
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
 * Extract company name from raw job text using Groq 8B instant model
 */
export async function extractCompanyName(rawText: string): Promise<string> {
  if (!groq) return "Unknown Company";
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: `Extract the primary company name hiring for this job from the raw text. Return ONLY the company name as a string, nothing else.\n\nText: ${rawText.substring(0, 4000)}`
        }
      ]
    });
    return response.choices[0]?.message?.content?.trim() || "Unknown Company";
  } catch (err) {
    console.warn("Company extraction failed:", err);
    return "Unknown Company";
  }
}

/**
 * The Distiller Agent: analyzes raw HTML/text and company intel to generate a structured job post.
 */
export async function distillJobData(rawText: string, companyIntel: string): Promise<Omit<JobPost, 'id' | 'is_active' | 'created_at' | 'updated_at'>> {
  if (!groq) throw new Error("GROQ_API_KEY is missing");

  const prompt = `
    Analyze the following raw text from a job posting and company intelligence search snippets.
    Extract the requested details and format them strictly.

    Generate a 3-bullet AI summary for the "description".
    Provide salary uniformly in INR LPA (e.g. min/max). If salary is missing, make a realistic guess based on role and experience.
    Make sure to integrate culture rating, top pro, and top con (from the company intel if available, or realistically hypothesize if snippets are sparse).
    Ensure the tech stack array is very precise.

    You must output ONLY a valid JSON object with EXACTLY the following structure. Do NOT wrap it in markdown block quotes.

    {
      "company": {
        "name": "string",
        "website": "string",
        "size": "Startup" | "Mid-size" | "Large" | "Enterprise",
        "industry": "string"
      },
      "role": "string",
      "experience_level": "Internship" | "Entry-level" | "Mid-level" | "Senior" | "Lead" | "Principal",
      "job_type": "Full-time" | "Part-time" | "Contract" | "Freelance",
      "pay": {
        "min": 0,
        "max": 0,
        "currency": "INR"
      },
      "remote_status": "Remote" | "Hybrid" | "On-site",
      "location": "string",
      "tech_stack": ["string"],
      "match_score": 0,
      "match_explanation": "1 sentence explanation of the score",
      "missing_skills": ["string"],
      "description": "3-bullet AI summary of the role including the culture rating, top pro, and top con.",
      "responsibilities": ["string"],
      "requirements": ["string"],
      "apply_url": "string or empty",
      "posted_at": "ISO 8601 date",
      "apply_by": "string or empty",
      "tags": ["string"]
    }
    
    User Profile Context:
    ${JSON.stringify(meData, null, 2)}

    Raw Job Post Text:
    ${rawText.substring(0, 10000)}

    Company Intel Snippets:
    ${companyIntel}
  `;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are a master technical recruiter extracting structured job data perfectly into JSON format." },
      { role: "user", content: prompt }
    ]
  });

  const text = response.choices[0]?.message?.content ?? '{}';
  const parsedData = JSON.parse(text);

  if (
    !parsedData.match_explanation ||
    typeof parsedData.match_explanation !== "string" ||
    parsedData.match_explanation.trim().length === 0
  ) {
    console.warn("[Distiller] match_explanation was empty — filling with fallback.");
    parsedData.match_explanation = `${parsedData.match_score ?? 0}% match based on tech stack alignment.`;
  }

  // Ensure defaults for enums
  if (!["Startup", "Mid-size", "Large", "Enterprise"].includes(parsedData.company?.size)) parsedData.company.size = "Startup";
  if (!["Internship", "Entry-level", "Mid-level", "Senior", "Lead", "Principal"].includes(parsedData.experience_level)) parsedData.experience_level = "Entry-level";
  if (!["Full-time", "Part-time", "Contract", "Freelance"].includes(parsedData.job_type)) parsedData.job_type = "Full-time";
  if (!["Remote", "Hybrid", "On-site"].includes(parsedData.remote_status)) parsedData.remote_status = "Remote";

  return parsedData as Omit<JobPost, 'id' | 'is_active' | 'created_at' | 'updated_at'>;
}
