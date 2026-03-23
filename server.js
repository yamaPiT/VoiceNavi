import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

    const modelName = process.env.VITE_GEMINI_MODEL || "gemini-3.1-flash-lite";
    console.log(`[DEBUG Server] Using model: ${modelName}`);
    console.log("[DEBUG Server] Request contents to Gemini:", JSON.stringify(contents, null, 2));

    const genAI = new GoogleGenerativeAI(API_KEY);
    const generationConfig = {
      temperature: 0.7,
    };

    // Gemmaモデルは現在 JSON mode (responseMimeType) をサポートしていないため、
    // geminiを含むモデルの場合のみ設定を有効化する
    if (modelName.toLowerCase().includes("gemini")) {
      generationConfig.responseMimeType = "application/json";
    }

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig
    });

    const result = await model.generateContent({ contents });
    const response = result.response;
    const rawText = response.text();
    console.log("[DEBUG Server] Gemini Raw Response TEXT:", rawText);

    if (!rawText) {
      console.error("[Gemini API Error] Empty response");
      return res.status(500).json({ error: "No response from Gemini API" });
    }
    
    // JSON Parse
    let parsed = null;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
         parsed = JSON.parse(jsonMatch[0]);
      } else {
         throw new Error("No JSON found in response");
      }
    } catch(err) {
      console.error("[JSON Parse Error] Raw text:", rawText);
      return res.status(500).json({ error: "Failed to parse JSON from AI response", rawText });
    }

    res.json(parsed);

  } catch (error) {
    console.error("[/api/chat Exception]", error);
    // SDKの429エラーはステータスコードをそのままクライアントに転送する
    const statusCode = error.status || 500;
    res.status(statusCode).json({ error: error.message || 'Internal Server Error' });
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

    const isSSML = text.trim().startsWith('<speak>');
    let finalSSML = text;
    if(isSSML) {
       // 頭切れ（再生開始遅延）対策として300msの無音時間を先頭に強制挿入する
       finalSSML = text.replace(/<speak>/i, '<speak><break time="300ms"/>');
    }

    const requestBody = {
      input: isSSML ? { ssml: finalSSML } : { text: text },
      voice: { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B' },
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
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[CRITICAL] Port ${PORT} is already in use. Please kill the process using this port.`);
  } else {
    console.error('[CRITICAL] Server failed to start:', err);
  }
});
