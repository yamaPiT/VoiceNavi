import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

async function testFinal() {
  const API_KEY = process.env.VITE_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(API_KEY);
  
  const modelName = 'gemini-2.0-flash';
  console.log(`Final Test: ${modelName}...`);
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Hello, are you functional?");
    console.log(`[SUCCESS] ${modelName} responded: ${result.response.text()}`);
  } catch (err) {
    console.log(`[FINAL FAIL] ${modelName}: ${err.message}`);
  }
}

testFinal();
