import dotenv from 'dotenv';
dotenv.config();

async function listVoices() {
  const key = process.env.VITE_GOOGLE_CLOUD_TTS_API_KEY;
  if (!key) {
    console.error("No TTS API Key found.");
    return;
  }
  const url = `https://texttospeech.googleapis.com/v1/voices?key=${key}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.voices) {
      const jaVoices = data.voices.filter(v => v.languageCodes.includes('ja-JP'));
      console.log(jaVoices.map(v => `${v.name} (${v.ssmlGender})`).join('\n'));
    } else {
      console.log("Error:", data);
    }
  } catch(e) {
    console.error(e);
  }
}
listVoices();
