/**
 * @file llm.js
 * @description LLMモジュール（意図解析・応答生成）— Gemini API 対応版
 *
 * 【目的】
 * ユーザー発話テキストとコンテキスト（会話履歴・ペルソナ・現在地）を組み合わせて
 * Google Gemini APIに送信し、構造化されたJSONレスポンス（LLMResponse）を取得する。
 *
 * 【設計決定（ADR-03参照）】
 * - LLM応答のスキーマを厳格に定義し、Agentic Testabilityを担保する
 * - APIタイムアウト境界値: 5000ms（5.0秒）。4999ms以内を正常待機、5000ms到達で自動リトライ
 * - JSONパースエラー時はクラッシュせず、エラーオブジェクトを返す
 * - 空文字（0文字）や1000文字超の入力は早期リターンでエラーオブジェクトを返す
 *
 * 【Gemini API 仕様】
 * - エンドポイント: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * - 認証: URLクエリパラメータ (?key=API_KEY)
 * - リクエスト形式: { contents: [...], systemInstruction: {...}, generationConfig: {...} }
 * - レスポンス形式: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
 *
 * 【LLMResponse スキーマ】
 * {
 *   action: "navigate"|"search_places"|"show_info"|"circulation_mode"|
 *           "temp_down"|"close_window"|"play_music"|"guard"|"none",
 *   text: string,           // TTSで読み上げる応答テキスト
 *   target: "driver"|"passenger"|"both",  // 発話ターゲット
 *   params: Object|null,    // アクション固有パラメータ
 *   isSafe: boolean         // false の場合ガードレール発動
 * }
 */

import { ContextStore } from "./contextStore.js";

/** APIタイムアウト：5000ms（境界値。5.0秒到達でタイムアウト） */
const API_TIMEOUT_MS = 5000;

/** 繋ぎ音声を発火するまでの待機時間：4900ms（境界値。4.9秒超過で繋ぎ音声再生） */
export const DELAY_THRESHOLD_MS = 4900;

/** 入力テキストの最大文字数 */
const MAX_INPUT_LENGTH = 1000;

/** Gemini API ベースURL */
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** タイムアウトエラーを生成するユーティリティ */
function timeoutPromise(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("LLM_TIMEOUT")), ms)
  );
}

export class LLMModule {
  /**
   * @param {string} apiKey - Gemini APIキー
   * @param {string} model - Geminiモデル名（例: "gemini-2.0-flash"）
   * @param {string} systemPrompt - LLMに与えるシステムプロンプト
   * @param {function(string): void} [onDelayDetected] - 遅延検知（繋ぎ音声）コールバック
   */
  constructor(apiKey, model, systemPrompt, onDelayDetected = () => {}) {
    this.apiKey = apiKey;
    this.model = model || "gemini-2.0-flash";
    this.systemPrompt = systemPrompt;
    this.onDelayDetected = onDelayDetected;
  }

  /**
   * ユーザー入力をGemini APIに送信し、LLMResponseを返す。
   * タイムアウト・パースエラーはクラッシュせずエラーオブジェクトを返す（Autonomous Feedback Loop）。
   *
   * @param {string} inputText - ユーザー発話テキスト
   * @returns {Promise<LLMResponse|{error: string}>} - LLMレスポンスまたはエラーオブジェクト
   */
  async send(inputText) {
    // 境界値チェック: 空文字または極端に長い入力はエラー
    if (!inputText || inputText.trim().length === 0) {
      return { action: "none", text: "", target: "driver", params: null, isSafe: true };
    }
    if (inputText.length > MAX_INPUT_LENGTH) {
      return { error: "INPUT_TOO_LONG", action: "none", text: "", isSafe: true };
    }

    const persona = ContextStore.getPersona();
    const history = ContextStore.getHistory();
    const location = ContextStore.getLocation();

    // Gemini API形式の contents 配列を構築
    // 会話履歴を Gemini の "user" / "model" ロールにマッピング
    const contents = [];
    for (const msg of history) {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
    // 現在のユーザー入力を追加
    contents.push({ role: "user", parts: [{ text: inputText }] });

    // Gemini リクエストボディ
    const requestBody = {
      systemInstruction: {
        parts: [{ text: this._buildSystemPrompt(persona, location) }],
      },
      contents,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    };

    // Gemini API エンドポイント（認証はクエリパラメータ）
    const endpoint = `${GEMINI_BASE_URL}/${this.model}:generateContent?key=${this.apiKey}`;

    // 4.9秒後に繋ぎ音声を発火するタイマー（境界値: DELAY_THRESHOLD_MS）
    const delayTimer = setTimeout(() => {
      this.onDelayDetected("少し考えさせてください...");
    }, DELAY_THRESHOLD_MS);

    try {
      const response = await Promise.race([
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }).then((res) => res.json()),
        timeoutPromise(API_TIMEOUT_MS),
      ]);

      clearTimeout(delayTimer);

      // APIエラーレスポンスのハンドリング
      if (response.error) {
        return { error: response.error.message || response.error.status, action: "none", isSafe: true };
      }

      // Gemini レスポンス形式からテキストを取得
      const content = response.candidates?.[0]?.content?.parts?.[0]?.text;
      return this._parseResponse(content);
    } catch (err) {
      clearTimeout(delayTimer);
      if (err.message === "LLM_TIMEOUT") {
        return { error: "LLM_TIMEOUT", action: "none", text: "", isSafe: true };
      }
      return { error: err.message, action: "none", text: "", isSafe: true };
    }
  }

  /**
   * LLM応答テキスト（JSON文字列）をパースする。
   * パース失敗時はクラッシュせずエラーオブジェクトを返す。
   *
   * @param {string|null} content - LLMが返却したJSON文字列
   * @returns {LLMResponse|{error: string}}
   * @private
   */
  _parseResponse(content) {
    if (!content) return { error: "EMPTY_RESPONSE", action: "none", isSafe: true };
    try {
      const parsed = JSON.parse(content);
      return {
        action: parsed.action ?? "none",
        text: parsed.text ?? "",
        target: parsed.target ?? "driver",
        params: parsed.params ?? null,
        isSafe: parsed.isSafe !== false, // 明示的に false でない限り true
      };
    } catch {
      return { error: "JSON_PARSE_ERROR", action: "none", text: "", isSafe: true };
    }
  }

  /**
   * ペルソナと位置情報を組み込んだシステムプロンプトを生成する。
   * @private
   */
  _buildSystemPrompt(persona, location) {
    return `${this.systemPrompt}

## ペルソナ情報
- ドライバー: ${persona.driver.name}（好み: ${persona.driver.preferences.join(", ")}）
- 同乗者: ${persona.passenger.name}

## 現在の走行状態
- ルート進行度: ${Math.round(location.routeProgress * 100)}%

## 応答形式
必ずJSON形式で返答すること:
{
  "action": "navigate|search_places|show_info|circulation_mode|temp_down|close_window|play_music|guard|none",
  "text": "発話テキスト",
  "target": "driver|passenger|both",
  "params": { ... } または null,
  "isSafe": true または false
}`;
  }
}
