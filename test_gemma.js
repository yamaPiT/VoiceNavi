import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

async function testGemmaQuota() {
  const API_KEY = process.env.VITE_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(API_KEY);
  
  const name = 'gemma-3-27b-it';
  console.log(`Testing Gemma: ${name}...`);
  try {
    const model = genAI.getGenerativeModel({ model: name });
    const result = await model.generateContent("Hello, what are your limits?");
    console.log(`[OK] Success! Gemma responded.`);
  } catch (err) {
    console.log(`[Gemma ERR] ${err.status}: ${err.message}`);
  }
}

testGemmaQuota();
