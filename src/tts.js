/**
 * @file tts.js
 * @description 音声出力（TTS）モジュール
 *
 * 【目的】
 * Web Speech API の SpeechSynthesis を使い、テキストを音声で読み上げる。
 * 読み上げ完了時にコールバック (onEnd) を呼び出す。
 *
 * 【設計決定】
 * - TTSモジュールは読み上げのみを責任とし、テキストの生成はLLMモジュールに委ねる
 * - 読み上げ中でも割り込みで新しいテキストを再生できるよう cancel() を呼ぶ
 */

export class TTSModule {
  /**
   * @param {function(): void} [onEnd] - 読み上げ完了時のコールバック（省略可）
   */
  constructor(onEnd = () => {}) {
    this.synth = window?.speechSynthesis || null;
    this.onEnd = onEnd;
    if (!this.synth) {
      console.warn("[TTS] このブラウザは SpeechSynthesis に対応していません。");
    }
  }

  /**
   * テキストを音声で読み上げる。
   * 既に読み上げ中の場合は中断して即座に新しいテキストを開始する。
   *
   * @param {string} text - 読み上げるテキスト（空文字の場合は何もしない）
   */
  speak(text) {
    if (!this.synth || !text || text.trim().length === 0) return;

    // 前の読み上げがあれば中断
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 1.0;
    utterance.onend = () => this.onEnd();
    this.synth.speak(utterance);
  }

  /** 読み上げを中断する */
  cancel() {
    if (this.synth) this.synth.cancel();
  }
}
