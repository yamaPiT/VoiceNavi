import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

async function testQuotaDetails() {
  const API_KEY = process.env.VITE_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(API_KEY);
  
  const name = 'gemini-2.0-flash';
  console.log(`Testing: ${name} (with detail inspection)...`);
  try {
    const model = genAI.getGenerativeModel({ model: name });
    const result = await model.generateContent("Hi");
    console.log(`[OK] Success!`);
  } catch (err) {
    console.log(`[ERR] Status: ${err.status}`);
    console.log(`[ERR] Message: ${err.message}`);
    if (err.response) {
       // Inspect raw response if possible
    }
  }
}

testQuotaDetails();
