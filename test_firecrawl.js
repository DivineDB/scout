require('dotenv').config({ path: '.env.local' });
const FirecrawlApp = require('@mendable/firecrawl-js').default;

async function test() {
  const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  const query = 'site:jobs.lever.co "Product Designer" "Remote India"';
  console.log("Searching Firecrawl for:", query);
  try {
    const res = await firecrawl.search(query, {
      pageOptions: { fetchPageContent: true },
      searchOptions: { limit: 3 }
    });
    console.log("Success! Found:", res.data?.length);
    if (res.data?.length > 0) {
      console.log("First result Title:", res.data[0].title);
      console.log("First result URL:", res.data[0].url);
      console.log("First result MD snippet:", res.data[0].markdown?.substring(0, 300));
    }
  } catch (e) {
    console.error("Firecrawl Error:", e.message);
  }
}
test();
