/**
 * @file contextStore.js
 * @description コンテキスト管理モジュール
 *
 * 【目的】
 * ペルソナ情報・会話履歴・走行状態を一元管理し、LLMが文脈（過去の会話・現在地・嗜好）を
 * 考慮した応答を生成できるようにする。
 *
 * 【設計決定（ADR参照）】
 * - 会話履歴は最新20ターンに制限し、LLMへのトークン消費を抑制する（境界値: 20）
 * - ContextStoreはシングルトンオブジェクトとして export し、各モジュールが共有参照する
 * - ルート進行度 (routeProgress) は 0.0〜1.0 の正規化値で表現し、UIやLLMが位置コンテキストに利用する
 */

/** 会話履歴の最大保持ターン数（境界値） */
const MAX_HISTORY_TURNS = 20;

/** @type {ContextState} アプリケーション全体のコンテキスト状態 */
const state = {
  persona: {
    driver: {
      name: "ショウヘイ",
      preferences: ["サザンオールスターズ", "湘南ドライブ", "海の見えるカフェ"],
    },
    passenger: {
      name: "マミコ",
    },
  },
  history: [],
  location: {
    current: { lat: 35.3197, lng: 139.5503 }, // 出発地: 鎌倉駅 初期値
    routeProgress: 0.0,                          // 0.0: 出発地 / 1.0: 目的地
  },
  musicPlaying: false,
  retryCount: 0,
};

export const ContextStore = {
  /**
   * 会話履歴にメッセージを追加する。
   * 最大20ターンを超えた場合は先頭の古いメッセージを削除する（境界値制御）。
   *
   * @param {"user"|"assistant"} role - メッセージの発話者
   * @param {string} content - メッセージ内容
   */
  addHistory(role, content) {
    state.history.push({ role, content });
    if (state.history.length > MAX_HISTORY_TURNS) {
      state.history.shift(); // 先頭（最古）のメッセージを削除
    }
  },

  /**
   * 会話履歴・走行状態・リトライカウンタをリセットする。
   * LLMが3回連続失敗した際の初期化ハンドラとして呼ばれる。
   */
  reset() {
    state.history = [];
    state.retryCount = 0;
    state.musicPlaying = false;
  },

  /** @returns {Array} 現在の会話履歴 */
  getHistory() { return [...state.history]; },

  /** @returns {Object} ペルソナ情報 */
  getPersona() { return state.persona; },

  /** @returns {Object} 現在地・ルート進行度 */
  getLocation() { return { ...state.location }; },

  /** @returns {number} 現在のリトライ回数 */
  getRetryCount() { return state.retryCount; },

  /** リトライカウンタをインクリメントする */
  incrementRetry() { state.retryCount++; },

  /** リトライカウンタをリセットする（正常応答時に呼ぶ） */
  resetRetry() { state.retryCount = 0; },

  /**
   * 走行位置を更新する。
   * @param {{ lat: number, lng: number }} coords - 現在の緯度経度
   * @param {number} progress - ルート進行度 (0.0〜1.0)
   */
  updateLocation(coords, progress) {
    state.location = { current: coords, routeProgress: progress };
  },

  /** @param {boolean} playing - 音楽再生中フラグ */
  setMusicPlaying(playing) { state.musicPlaying = playing; },

  /** @returns {boolean} 音楽再生中かどうか */
  isMusicPlaying() { return state.musicPlaying; },
};
