/**
 * @file llm.test.js
 * @description Gemini 対応版 LLMModule の単体テスト
 *
 * 【テスト方針】
 * - Gemini API のリクエスト構造（contents, systemInstruction）が正しいか検証。
 * - 正常系: Gemini のレスポンス形式から JSON を正しくパースできるか検証。
 * - 異常系: タイムアウト（5秒）、パースエラー、空入力などが正当に処理されるか検証。
 */

import { jest } from "@jest/globals";
import { LLMModule, DELAY_THRESHOLD_MS } from "../src/llm.js";
import { ContextStore } from "../src/contextStore.js";

// fetch のグローバルモック
global.fetch = jest.fn();

describe("LLMModule (Gemini API)", () => {
  let llm;
  const mockApiKey = "test-api-key";
  const mockModel = "gemini-2.0-flash";
  const mockSystemPrompt = "System Prompt";
  const onDelayDetected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    ContextStore.reset();
    llm = new LLMModule(mockApiKey, mockModel, mockSystemPrompt, onDelayDetected);
  });

  // ============================================================
  // テスト: リクエスト構成
  // ============================================================
  test("[正常系] send() が正しい Gemini エンドポイントへ fetch を発行する", async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"action":"none","text":"Hi"}' }] } }]
      }),
    });

    await llm.send("こんにちは");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`models/${mockModel}:generateContent?key=${mockApiKey}`),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  // ============================================================
  // テスト: 正常応答パース
  // ============================================================
  test("[正常系] Gemini レスポンスの JSON 文字列をパースして LLMResponse を返す", async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"action":"play_music","text":"OK","params":{"title":"SAS"}}' }] } }]
      }),
    });

    const res = await llm.send("音楽かけて");

    expect(res.action).toBe("play_music");
    expect(res.text).toBe("OK");
    expect(res.params.title).toBe("SAS");
    expect(res.isSafe).toBe(true);
  });

  // ============================================================
  // テスト: 異常系 (タイムアウト・パースエラー)
  // ============================================================
  test("[異常系] JSONパース失敗時に JSON_PARSE_ERROR を返す", async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Invalid JSON" }] } }]
      }),
    });

    const res = await llm.send("テスト");
    expect(res.error).toBe("JSON_PARSE_ERROR");
  });

  test("[正常系] isSafe: false が含まれる場合に正しく反映する", async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"action":"none","text":"ダメです","isSafe":false}' }] } }]
      }),
    });

    const res = await llm.send("信号無視して");
    expect(res.isSafe).toBe(false);
  });

  // ============================================================
  // テスト: 遅延検知 (4.9s)
  // ============================================================
  test("[正常系] 4.9秒経過後に onDelayDetected コールバックが呼ばれる", (done) => {
    // 応答を遅らせる
    fetch.mockReturnValue(new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          json: async () => ({ candidates: [] })
        });
      }, 6000);
    }));

    llm.send("遅いテスト");

    // 4.9秒（DELAY_THRESHOLD_MS）より少し後にチェック
    setTimeout(() => {
      try {
        expect(onDelayDetected).toHaveBeenCalledWith("少し考えさせてください...");
        done();
      } catch (error) {
        done(error);
      }
    }, DELAY_THRESHOLD_MS + 100);
  }, 10000);

  // ============================================================
  // テスト: 境界値 (空文字・長文)
  // ============================================================
  test("[境界値] 空文字入力時は fetch を呼ばず action: none を返す", async () => {
    const res = await llm.send("  ");
    expect(fetch).not.toHaveBeenCalled();
    expect(res.action).toBe("none");
  });
});
