import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

async function listVisibleModels() {
  const API_KEY = process.env.VITE_GEMINI_API_KEY;
  if (!API_KEY) {
    console.error("API Key missing");
    return;
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  
  try {
    // Note: The SDK might not have a direct listModels, but we can try to fetch it via the base URL
    // or use the known ones one by one.
    // Actually, let's just try to generate a tiny content with a few likely candidates.
    const candidates = [
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-001',
      'gemini-1.5-flash-002',
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash',
      'gemini-flash-latest'
    ];

    for (const modelName of candidates) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hi");
        console.log(`[PASS] ${modelName}`);
      } catch (e) {
        console.log(`[FAIL] ${modelName}: ${e.message}`);
      }
    }
  } catch (err) {
    console.error("Error during listing:", err);
  }
}

listVisibleModels();
