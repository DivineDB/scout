const { GoogleGenAI } = require("@google/genai");

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.list();
    for await (const model of response) {
      if (model.name.includes("gemini")) {
        console.log(model.name);
      }
    }
  } catch (err) {
    console.error(err);
  }
}
run();
