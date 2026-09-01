import Groq from "groq-sdk";
import "dotenv/config";

async function main() {
	const g = new Groq({ apiKey: process.env.GROQ_API_KEY });
	const m = await g.models.list();
	console.log(m.data.map((x) => x.id).join("\n"));
}
main();
