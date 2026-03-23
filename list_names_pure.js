import dotenv from 'dotenv';

dotenv.config();

async function listNamesOnly() {
  const API_KEY = process.env.VITE_GEMINI_API_KEY;
  if (!API_KEY) return;

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.models) {
      data.models.forEach(m => {
        console.log(`[ID] ${m.name.replace('models/', '')}  (${m.displayName})`);
      });
    } else {
      console.log("No models field in response:", data);
    }
  } catch (err) {
    console.error(err);
  }
}

listNamesOnly();
