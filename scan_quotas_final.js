import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

async function findFunctionalModel() {
  const API_KEY = process.env.VITE_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(API_KEY);
  
  // visible_models.txt から抽出した候補
  const candidates = [
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-001',
    'gemini-2.5-flash',
    'gemini-pro-latest',
    'gemini-2.0-flash-lite-001'
  ];

  console.log("Starting exhaustive check...");

  for (const name of candidates) {
    console.log(`Checking: ${name}`);
    try {
      const model = genAI.getGenerativeModel({ model: name });
      const result = await model.generateContent("Hello");
      console.log(`[PASS] ${name} is working!`);
      return; // Found one!
    } catch (err) {
      if (err.status === 429) {
        // Extract limit if available in message
        const limitMatch = err.message.match(/limit: (\d+)/);
        const limit = limitMatch ? limitMatch[1] : 'unknown';
        console.log(`[429] ${name} (Limit: ${limit})`);
      } else {
        console.log(`[FAIL] ${name} (${err.status}): ${err.message}`);
      }
    }
  }
}

findFunctionalModel();
