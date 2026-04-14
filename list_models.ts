import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({});
async function list() {
  const models = await ai.models.list();
  for await (const model of models) {
    if (model?.name && model.name.includes("gemini")) {
      console.log(model.name);
    }
  }
}
list();
