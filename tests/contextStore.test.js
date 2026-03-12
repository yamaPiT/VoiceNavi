/**
 * @file contextStore.test.js
 * @description ContextStore の単体テスト
 *
 * 【テスト方針（SW205 Section 3.2.4 検証条件対応）】
 * - 会話履歴の最大件数（20件）境界値テスト
 * - reset() で履歴とリトライカウンタが初期化されることを検証
 */

import { ContextStore } from "../src/contextStore.js";

describe("ContextStore", () => {
  beforeEach(() => {
    ContextStore.reset();
  });

  // ============================================================
  // 会話履歴
  // ============================================================
  test("[正常系] addHistory でメッセージが追加される", () => {
    ContextStore.addHistory("user", "こんにちは");
    expect(ContextStore.getHistory().length).toBe(1);
    expect(ContextStore.getHistory()[0].content).toBe("こんにちは");
  });

  test("[境界値] 20件を超えると先頭から削除される（最大20件）", () => {
    for (let i = 0; i < 25; i++) {
      ContextStore.addHistory("user", `メッセージ${i}`);
    }
    expect(ContextStore.getHistory().length).toBe(20);
    // 最古の5件（0〜4）が削除され、5〜24が残っているはず
    expect(ContextStore.getHistory()[0].content).toBe("メッセージ5");
  });

  // ============================================================
  // リトライカウンタ
  // ============================================================
  test("[正常系] incrementRetry でカウンタが増える", () => {
    ContextStore.incrementRetry();
    ContextStore.incrementRetry();
    expect(ContextStore.getRetryCount()).toBe(2);
  });

  test("[正常系] resetRetry でカウンタが0に戻る", () => {
    ContextStore.incrementRetry();
    ContextStore.resetRetry();
    expect(ContextStore.getRetryCount()).toBe(0);
  });

  // ============================================================
  // reset()
  // ============================================================
  test("[正常系] reset() で履歴・リトライ・音楽フラグが初期化される", () => {
    ContextStore.addHistory("user", "テスト");
    ContextStore.incrementRetry();
    ContextStore.setMusicPlaying(true);
    ContextStore.reset();
    expect(ContextStore.getHistory().length).toBe(0);
    expect(ContextStore.getRetryCount()).toBe(0);
    expect(ContextStore.isMusicPlaying()).toBe(false);
  });

  // ============================================================
  // 位置更新
  // ============================================================
  test("[正常系] updateLocation で位置情報が更新される", () => {
    ContextStore.updateLocation({ lat: 35.3, lng: 139.5 }, 0.5);
    const loc = ContextStore.getLocation();
    expect(loc.current.lat).toBe(35.3);
    expect(loc.routeProgress).toBe(0.5);
  });
});
