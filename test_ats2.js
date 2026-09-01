const cheerio = require('cheerio');

async function test() {
  const url = 'https://jobs.lever.co/theathletic/fe515d03-cb73-49e8-baf8-0f471f20f956';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      }
    });
    console.log("Status:", res.status);
    const html = await res.text();
    const $ = cheerio.load(html);
    const jsonLd = $('script[type="application/ld+json"]').text();
    if (jsonLd) {
      console.log("Found JSON-LD!");
      const data = JSON.parse(jsonLd);
      console.log("Title:", data.title);
      console.log("Company:", data.hiringOrganization?.name);
      console.log("Desc length:", data.description?.length);
    } else {
      console.log("No JSON-LD found in HTML of length", html.length);
    }
  } catch (e) {
    console.error(e);
  }
}
test();
