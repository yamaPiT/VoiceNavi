/**
 * @file musicUI.js
 * @description 音楽再生UIアニメーションモジュール
 *
 * 【目的】
 * 著作権上の理由から、実際の音声データは再生しない。
 * 「音楽が流れている」状態を、車アイコン上部の♪アニメーションと
 * 吹き出しに表示した曲名で視覚的に表現する。
 *
 * 【設計決定（ADR-05参照）】
 * - play() は音声APIを一切呼ばない。CSSクラスのみで表現する
 * - 曲名が空文字またはnullの場合は吹き出しを表示せず、アニメーションのみ実行する
 * - stop() は再生中フラグをfalseにし、アニメーションクラスを除去する
 */

export class MusicUIModule {
  /**
   * @param {Object} elements - UIのDOM要素参照
   * @param {HTMLElement} elements.carIcon - 車アイコン要素
   * @param {HTMLElement} elements.musicBubble - 曲名吹き出し要素
   */
  constructor(elements = {}) {
    this.carIcon = elements.carIcon || null;
    this.musicBubble = elements.musicBubble || null;
    /** @type {boolean} 音楽再生中フラグ */
    this.isPlaying = false;
  }

  /**
   * 音楽再生UIを開始する。
   * 車アイコンに "playing" CSSクラスを付与し♪アニメーションを開始。
   * 曲名が存在する場合のみ吹き出しに表示する。
   *
   * @param {string|null} title - 再生中の曲名（空文字/nullの場合は吹き出し非表示）
   */
  play(title) {
    this.isPlaying = true;
    if (this.carIcon) {
      this.carIcon.classList.add("playing"); // ♪アニメーションCSSクラス付与
    }
    if (this.musicBubble) {
      if (title && title.trim().length > 0) {
        this.musicBubble.textContent = `♪ ${title}`;
        this.musicBubble.style.display = "block";
      } else {
        // 曲名が空またはnullの場合は吹き出しを表示しない（境界値）
        this.musicBubble.style.display = "none";
      }
    }
  }

  /**
   * 音楽再生UIを停止する。
   * 再生中フラグをfalseに設定し、CSSクラスを除去してアニメーションを停止する。
   */
  stop() {
    this.isPlaying = false;
    if (this.carIcon) {
      this.carIcon.classList.remove("playing");
    }
    if (this.musicBubble) {
      this.musicBubble.style.display = "none";
      this.musicBubble.textContent = "";
    }
  }
}
