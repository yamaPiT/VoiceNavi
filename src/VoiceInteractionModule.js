export class VoiceInteractionModule {
  constructor(apiKeyTTS) {
    this.apiKeyTTS = apiKeyTTS;
    this.recognition = null;
    this.isListening = false;
    this._initSTT();
  }

  _initSTT() {
    // ブラウザの互換性対応
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'ja-JP';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
    } else {
      console.warn('SpeechRecognition API is not supported in this browser.');
    }
  }

  /**
   * STTによる音声認識を開始し、認識結果のテキストを返すPromiseを返す。
   * @returns {Promise<string>} 認識したテキスト
   */
  async listen() {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        return reject(new Error("SpeechRecognition API not available."));
      }

      if (this.isListening) {
        this.recognition.stop();
      }

      this.isListening = true;

      this.recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        resolve(text);
      };

      this.recognition.onerror = (event) => {
        this.isListening = false;
        reject(event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        resolve(""); // 無音等で終了した場合
      };

      try {
        this.recognition.start();
      } catch(e) {
        reject(e);
      }
    });
  }

  /**
   * BFFを経由してTTS API (Neural2-F) の音声データを取得し再生する。
   * 失敗時はWeb Speech API (SpeechSynthesis)へ自動フォールバックする機能を含む。
   * @param {string} text 読み上げるテキスト
   * @param {Function} onStart 再生開始時のコールバック
   * @param {Function} onEnd 再生終了時のコールバック
   */
  async speak(text, onStart = null, onEnd = null) {
    if (!text || text.trim() === '') {
      if(onEnd) onEnd();
      return;
    }

    try {
      // BFFへTTSリクエスト
      const response = await fetch('http://localhost:3000/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
      });

      if (!response.ok) {
        throw new Error(`Google TTS BFF failed: ${response.statusText}`);
      }

      const data = await response.json();
      const audioContent = data.audioContent;
      const audio = new Audio("data:audio/mp3;base64," + audioContent);
      
      return new Promise((resolve) => {
        audio.onplay = () => {
          if(onStart) onStart();
        };
        audio.onended = () => {
          if(onEnd) onEnd();
          resolve();
        };
        audio.play().catch(e => {
          console.error("Audio playback failed:", e);
          this._fallbackSpeak(text, onStart, onEnd).then(resolve);
        });
      });

    } catch (error) {
      console.warn("Google Cloud TTS Error, falling back to Web Speech API:", error);
      return this._fallbackSpeak(text, onStart, onEnd);
    }
  }

  /**
   * ブラウザ標準のTTS機能。Google API失敗時の自己修復用フォールバック
   */
  _fallbackSpeak(text, onStart, onEnd) {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      
      utterance.onstart = () => {
        if(onStart) onStart();
      };
      
      utterance.onend = () => {
        if(onEnd) onEnd();
        resolve();
      };
      
      utterance.onerror = (e) => {
        console.error("SpeechSynthesisUtterance error", e);
        if(onEnd) onEnd();
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }
}
