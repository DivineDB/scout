// Local Scraper Snippet for LinkedIn / Glassdoor
// Run this snippet in the browser console of a job posting page.
// It will parse the job details and format it as a JSON payload
// to be easily pasted into the Scout "Manual Add" feature.

(function extractJobForScout() {
  const getText = (selectors) => {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el && el.innerText) return el.innerText.trim();
    }
    return "";
  };

  const payload = {
    url: window.location.href,
    company: getText([
      '.job-details-jobs-unified-top-card__company-name', // LinkedIn
      '[data-test="employer-name"]', // Glassdoor
      '.css-1b3v37v' // AmbitionBox (example)
    ]) || "Unknown Company",
    
    role: getText([
      '.job-details-jobs-unified-top-card__job-title', // LinkedIn
      '[data-test="job-title"]', // Glassdoor
      '.job-title'
    ]) || "Unknown Role",
    
    // Fallback to body text if specific descriptions aren't found
    raw_text: getText([
      '.jobs-description-content__text', // LinkedIn
      '#JobDescriptionContainer', // Glassdoor
    ]) || document.body.innerText.substring(0, 15000)
  };

  console.log("%c=== SCOUT PARSED JOB DATA ===", "color: #00FFC2; font-weight: bold; font-size: 14px;");
  console.log(JSON.stringify(payload, null, 2));
  console.log("%cCopy the JSON above and paste it into the Manual Add input.", "color: #0F172A; font-weight: bold;");
  
  // Try to push to clipboard directly
  try {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    console.log("%cData copied to clipboard automatically!", "color: #10B981;");
  } catch(e) {
    // Clipboard API might need focus or permission
  }
})();
