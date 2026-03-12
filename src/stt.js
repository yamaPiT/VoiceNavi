/**
 * @file stt.js
 * @description 音声入力（STT）モジュール
 *
 * 【目的】
 * Web Speech API の SpeechRecognition を使い、ユーザーの発話をテキスト化する。
 * 認識成功時にコールバック (onResult) を呼び出す。
 *
 * 【設計決定】
 * - STTモジュールはテキスト送出のみを責任とし、LLMへの送信は Router 経由で行う
 * - テスト環境では SpeechRecognition が存在しないため、環境依存のチェックを入れる
 */

export class STTModule {
  /**
   * @param {function(string): void} onResult - 音声認識テキストを受け取るコールバック
   */
  constructor(onResult) {
    this.onResult = onResult;
    this.recognition = null;
    this._initRecognition();
  }

  /**
   * SpeechRecognition を初期化する。
   * ブラウザが対応していない場合はコンソール警告のみ（クラッシュしない）。
   * @private
   */
  _initRecognition() {
    const SpeechRecognition =
      window?.SpeechRecognition || window?.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[STT] このブラウザは SpeechRecognition に対応していません。");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = "ja-JP";
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim().length > 0) {
        this.onResult(transcript.trim());
      }
    };

    this.recognition.onerror = (event) => {
      console.error(`[STT] 認識エラー: ${event.error}`);
    };
  }

  /** 音声認識を開始する */
  start() {
    if (!this.recognition) return;
    try { this.recognition.start(); } catch (e) { /* すでに開始済みの場合は無視 */ }
  }

  /** 音声認識を停止する */
  stop() {
    if (!this.recognition) return;
    try { this.recognition.stop(); } catch (e) { /* すでに停止済みの場合は無視 */ }
  }
}
