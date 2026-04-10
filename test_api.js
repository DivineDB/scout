async function testAI() {
  try {
    const res = await fetch("http://localhost:3000/api/job/generate-hook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job: {
          company: { name: "Test Corp", industry: "Tech" },
          role: "Frontend Engineer",
          tech_stack: ["React", "Next.js", "TypeScript"]
        },
        persona: {
          name: "Test User",
          graduation_year: "2024",
          experience_details: [{
            title: "Project",
            description: "Built a thing"
          }]
        }
      })
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", data);
  } catch(e) {
    console.error(e);
  }
}
testAI();
