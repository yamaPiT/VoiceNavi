/**
 * Gemini APIを用いた意図抽出および応答生成モジュール
 * （BFFサーバ経由で非同期通信を行う）
 */
export class LLMAgent {
  constructor(apiKey, systemPrompt) {
    // APIキーはBFF側で持たせるため、今回はダミーまたは不要
    this.apiKey = apiKey; 
    this.systemPrompt = systemPrompt;
    this.history = []; // チャット履歴
  }

  /**
   * ユーザーの発話を送信し、JSON形式の応答を得る。
   *
   * @param {string} userText 
   * @param {string} currentContext 現在の車の位置・状況コンテキスト
   * @param {Function} onDelay 応答が5秒以上遅延した場合のコールバック
   * @returns {Promise<Object>} パースされたJSONオブジェクト
   */
  async processInput(userText, currentContext = "", onDelay = null) {
    if (!userText || userText.trim() === '') return null;

    // 遅延検知タイマー
    const delayTimer = setTimeout(() => {
      if (onDelay) onDelay();
    }, 5000);

    let retries = 0;
    const maxRetries = 2; // 初回+2回の計3回試行

    while (retries <= maxRetries) {
      try {
        // BFFへのリクエスト
        const bffRequestBody = {
          userText: userText,
          currentContext: currentContext,
          history: this.history,
          systemPrompt: this.systemPrompt
        };

        const response = await fetch('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bffRequestBody)
        });

        clearTimeout(delayTimer);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`BFF Server Error: ${response.status} ${errText}`);
        }

        const parsed = await response.json();

        // 相手が文字列として返した場合の防御
        if (typeof parsed !== 'object') {
           throw new Error("Parsed result is not an object");
        }

        // 履歴を保持（オブジェクトとしてそのまま持ち、送信時に利用）
        this.history.push({ role: "user", text: userText });
        this.history.push({ role: "model", text: JSON.stringify(parsed) });
        
        return parsed;

      } catch (error) {
        clearTimeout(delayTimer);
        console.error(`LLM Error (Try ${retries + 1}):`, error);
        retries++;

        if (retries > maxRetries) {
          console.error("LLM Max retries exceeded. Invoking fallback.");
          // 自己修復フェーズ：3回失敗時はフォールバック応答を強制生成
          return {
            reply_text: "すみません、よく聞き取れませんでした。もう一度お願いできますか？",
            action: "none",
            target_landmark_id: "none",
            _isFallback: true
          };
        }
      }
    }
  }
}
