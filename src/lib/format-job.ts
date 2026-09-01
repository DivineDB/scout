/**
 * Utility functions for cleaning Company Name, Job Role, JD Descriptions, and parsing salary ranges.
 */

// ─── 1. Clean Company Name ───────────────────────────────────────────────────
export function cleanCompanyName(name: string | null | undefined, roleFallback?: string | null): string {
  let cleaned = (name || "").trim();

  // If the company name is an ATS domain or empty, try extracting from the role
  const isATS = /lever\.co|greenhouse\.io|ashbyhq|breezy\.hr|workable|via ats/i.test(cleaned);
  if ((isATS || !cleaned || cleaned === "Unknown") && roleFallback) {
    if (roleFallback.includes(" @ ")) {
      return roleFallback.split(" @ ").pop()!.trim();
    }
    if (roleFallback.includes(" - ")) {
      return roleFallback.split(" - ").pop()!.trim();
    }
    if (roleFallback.includes(" | ")) {
      return roleFallback.split(" | ").pop()!.trim();
    }
  }

  if (!cleaned) return "Unknown";

  // If the name itself has "Role @ Company", extract Company
  if (cleaned.includes(" @ ")) {
    const parts = cleaned.split(" @ ");
    return parts[parts.length - 1].trim();
  }

  // If "Company - Role" or "Role - Company"
  if (cleaned.includes(" - ")) {
    const parts = cleaned.split(" - ");
    if (/(designer|engineer|developer|manager|lead|frontend|backend|full-stack|fullstack|ui\/ux|intern)/i.test(parts[1])) {
      return parts[0].trim();
    }
    if (/(designer|engineer|developer|manager|lead|frontend|backend|full-stack|fullstack|ui\/ux|intern)/i.test(parts[0])) {
      return parts[parts.length - 1].trim();
    }
  }

  // Remove common web host prefixes/suffixes e.g. www., .com, Via ATS
  cleaned = cleaned.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").replace(/\.(?:com|io|co|ai|org|dev|net)$/i, "");
  if (cleaned.toLowerCase() === "via ats" || !cleaned) return "Company";

  return cleaned;
}

// ─── 2. Clean Job Role ─────────────────────────────────────────────────────────
export function cleanJobRole(role: string | null | undefined): string {
  if (!role) return "ROLE";
  let cleaned = role.trim();

  // If "Role @ Company", extract Role
  if (cleaned.includes(" @ ")) {
    cleaned = cleaned.split(" @ ")[0].trim();
  }

  // If "Company - Role", extract Role
  if (cleaned.includes(" - ")) {
    const parts = cleaned.split(" - ");
    if (/(designer|engineer|developer|manager|lead|frontend|backend|full-stack|fullstack|ui\/ux|intern)/i.test(parts[1])) {
      cleaned = parts[1].trim();
    } else if (/(designer|engineer|developer|manager|lead|frontend|backend|full-stack|fullstack|ui\/ux|intern)/i.test(parts[0])) {
      cleaned = parts[0].trim();
    }
  }

  return cleaned;
}

// ─── 3. Clean Description ───────────────────────────────────────────────────
export function cleanJobDescription(text: string | null | undefined): string {
  if (!text) return "";

  let cleaned = text.trim();

  // Strip preamble metadata headers common in Serper / ATS search snippets
  cleaned = cleaned.replace(/^(?:[A-Za-z0-9\s–\-\/\.,|&()]+\.\s*){1,5}(?=[A-Z][a-z]+\b|\bAt\b|\bWe\b|\bLooking\b|\bAbout\b|\bAs\b|\bOur\b|\bThe\b|\bJoin\b)/i, "");

  // Strip "Location. City. Employment Type. Full time." patterns
  cleaned = cleaned.replace(/^[^.]+\.\s*Location\..*?(?:Employment Type\..*?(?:Location Type\..*?)?)?\s*/i, "");
  cleaned = cleaned.replace(/Location\.\s*[^.]+\.\s*(Employment Type\.\s*[^.]+\.\s*)?(Location Type\.\s*[^.]+\.\s*)?/gi, "");

  // Capitalize first letter
  cleaned = cleaned.trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned || text;
}

// ─── 3b. Convert Description to Bullet Points ──────────────────────────────
export function getJobDescriptionBullets(
  text: string | null | undefined,
  responsibilities?: string[] | null
): string[] {
  if (responsibilities && responsibilities.length > 0) {
    return responsibilities.map((r) => cleanJobDescription(r)).filter((r) => r.length > 5);
  }

  const cleaned = cleanJobDescription(text);
  if (!cleaned) return [];

  const lineSplit = cleaned
    .split(/\n+|[•\*\-\u2022\u2023\u25E6\u2043\u2219]/)
    .map((line) => line.replace(/^\s*\d+[\.\)]\s*/, "").trim())
    .filter((line) => line.length > 12);

  if (lineSplit.length >= 2) {
    return lineSplit.slice(0, 6);
  }

  const sentences = cleaned
    .split(/(?<=\.|\;|\!)\s+/)
    .map((s) => s.trim().replace(/^[\.\-\s\/]+/, ""))
    .filter((s) => s.length > 15);

  if (sentences.length > 0) {
    return sentences.slice(0, 5);
  }

  return [cleaned];
}

// ─── 4. Parse & Format Salary ────────────────────────────────────────────────
export interface ParsedSalary {
  min: number;
  max: number;
  currency: string;
  formatted: string;
  isUndisclosed: boolean;
}

export function parseAndFormatSalary(
  pay?: { min?: number; max?: number; currency?: string } | null,
  salaryInfo?: string | null,
  description?: string | null
): ParsedSalary {
  if (pay && ((pay.min && pay.min > 0) || (pay.max && pay.max > 0))) {
    const min = pay.min || pay.max || 0;
    const max = pay.max || pay.min || 0;
    const currency = pay.currency || "INR";
    const prefix = currency === "USD" ? "$" : "₹";
    const suffix = currency === "USD" ? "k" : "L";
    const formatted = min === max ? `${prefix}${min}${suffix}` : `${prefix}${min}–${max}${suffix}`;
    return { min, max, currency, formatted, isUndisclosed: false };
  }

  const info = salaryInfo || "";
  const lpaMatch = info.match(/(?:₹|INR)?\s*(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(?:LPA|L|Lakhs?)/i) ||
                   info.match(/(?:₹|INR)?\s*(\d+(?:\.\d+)?)\s*(?:LPA|L|Lakhs?)/i);

  if (lpaMatch) {
    const min = parseFloat(lpaMatch[1]);
    const max = lpaMatch[2] ? parseFloat(lpaMatch[2]) : min;
    const formatted = min === max ? `₹${min}L` : `₹${min}–${max}L`;
    return { min, max, currency: "INR", formatted, isUndisclosed: false };
  }

  return { min: 0, max: 0, currency: "INR", formatted: "Undisclosed", isUndisclosed: true };
}
