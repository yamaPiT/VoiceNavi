import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

async function discoverModels() {
  const API_KEY = process.env.VITE_GEMINI_API_KEY;
  if (!API_KEY) {
    console.error("API Key missing in .env");
    return;
  }

  // The SDK doesn't expose listModels directly easily in all versions, 
  // but we can use the REST API via fetch.
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error("API Error:", data.error);
      return;
    }

    console.log("--- Available Models ---");
    const flashModels = data.models.filter(m => m.name.includes('flash'));
    
    for (const model of data.models) {
      console.log(`Model: ${model.name}`);
      console.log(`  DisplayName: ${model.displayName}`);
      console.log(`  Supported Actions: ${model.supportedGenerationMethods.join(', ')}`);
      console.log('---');
    }

    console.log("\n--- Testing Flash Candidates ---");
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    for (const m of flashModels) {
      // Remove 'models/' prefix for the SDK if it adds it.
      const shortName = m.name.replace('models/', '');
      try {
        const model = genAI.getGenerativeModel({ model: shortName });
        const result = await model.generateContent("Test");
        console.log(`[PASS] ${shortName}`);
      } catch (err) {
        console.log(`[FAIL] ${shortName}: ${err.message}`);
      }
    }

  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

discoverModels();
