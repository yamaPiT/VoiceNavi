import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

async function testVersions() {
  const API_KEY = process.env.VITE_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(API_KEY);
  
  const candidates = [
    'gemini-1.5-flash-001',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash-8b-001',
    'gemini-1.5-pro-001',
    'gemini-1.5-pro-002'
  ];

  for (const name of candidates) {
    console.log(`Testing: ${name}...`);
    try {
      const model = genAI.getGenerativeModel({ model: name });
      const result = await model.generateContent("Hi");
      console.log(`[OK] ${name}`);
    } catch (err) {
      console.log(`[ERR] ${name}: ${err.message}`);
    }
  }
}

testVersions();
