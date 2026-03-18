import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // 必要な場合は使うが、Node 18+なら標準fetchが使える

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ==========================================
// Gemini API Endpoint (Chat)
// ==========================================
app.post('/api/chat', async (req, res) => {
  try {
    const { userText, currentContext, history, systemPrompt } = req.body;
    
    if (!userText) {
      return res.status(400).json({ error: 'userText is required' });
    }

    const API_KEY = process.env.VITE_GEMINI_API_KEY;
    if (!API_KEY) {
      console.error("Gemini API Key is missing");
      return res.status(500).json({ error: 'Server configuration error (API Key)' });
    }

    const promptMessage = `
【現在地の状況】: ${currentContext}
【ドライバーの発話】: ${userText}

上記の文脈と履歴を踏まえて、JSON形式で応答してください。
`;

    const contents = [];
    
    // System Prompt
    contents.push({
      role: "user",
      parts: [{ text: systemPrompt }]
    });
    contents.push({
      role: "model",
      parts: [{ text: "承知いたしました。JSONで応答します。" }]
    });

    // History (last 6 messages)
    const recentHistory = (history || []).slice(-6);
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role,
        parts: [{ text: msg.text }]
      });
    }

    // Current User Input
    contents.push({
      role: "user",
      parts: [{ text: promptMessage }]
    });

    const requestBody = {
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error(`[Gemini API Status Error] ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(`[Gemini Response Body]`, text);
      return res.status(response.status).json({ error: `Gemini API Error: ${response.status}` });
    }

    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
      console.error("[Gemini API Error] No response candidates");
      return res.status(500).json({ error: "No response from Gemini API" });
    }

    const rawText = data.candidates[0].content.parts[0].text;
    
    // JSON Parse
    let parsed = null;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
         parsed = JSON.parse(jsonMatch[0]);
      } else {
         throw new Error("No JSON mapped");
      }
    } catch(err) {
      console.error("[JSON Parse Error] Raw text:", rawText);
      return res.status(500).json({ error: "Failed to parse JSON from AI response", rawText });
    }

    res.json(parsed);

  } catch (error) {
    console.error("[/api/chat Exception]", error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// ==========================================
// Google Cloud TTS Endpoint
// ==========================================
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const API_KEY = process.env.VITE_GOOGLE_CLOUD_TTS_API_KEY;
    if (!API_KEY) {
      console.error("GCP TTS API Key is missing");
      return res.status(500).json({ error: 'Server configuration error (API Key)' });
    }

    const requestBody = {
      input: { text: text },
      voice: { languageCode: 'ja-JP', name: 'ja-JP-Neural2-F' },
      audioConfig: { audioEncoding: 'MP3' }
    };

    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error(`[TTS API Status Error] ${response.status} ${response.statusText}`);
      const errText = await response.text();
      console.error(`[TTS Response Body]`, errText);
      return res.status(response.status).json({ error: `TTS API Error: ${response.status}` });
    }

    const data = await response.json();
    res.json({ audioContent: data.audioContent });

  } catch (error) {
    console.error("[/api/tts Exception]", error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// ==========================================
// Start Server
// ==========================================
app.listen(PORT, () => {
  console.log(`BFF Server is running on http://localhost:${PORT}`);
});
