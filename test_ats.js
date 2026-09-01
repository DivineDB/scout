const cheerio = require('cheerio');

async function test() {
  const url = 'https://jobs.lever.co/figma/6e41b964-6725-46ed-addd-468c857de7fb'; // Example ATS URL
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const jsonLd = $('script[type="application/ld+json"]').text();
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd);
      console.log("Title:", data.title);
      console.log("Company:", data.hiringOrganization?.name);
      console.log("Description snippet:", data.description?.substring(0, 200));
    } catch(e) {
      console.error(e);
    }
  } else {
    console.log("No JSON-LD found");
  }
}

test();
