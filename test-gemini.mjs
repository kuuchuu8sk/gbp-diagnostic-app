import { GoogleGenAI } from "@google/genai";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const keyMatches = env.match(/GEMINI_API_KEY=([^\s]+)/);
const ai = new GoogleGenAI({ apiKey: keyMatches ? keyMatches[1] : "" });
async function test() {
  try {
    const listRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + (keyMatches ? keyMatches[1] : ""));
    const modelsData = await listRes.json();
    console.log(modelsData.models.map(m => m.name).join("\n"));
  } catch (e) {
    console.error("List failed", e);
  }
}
test();
