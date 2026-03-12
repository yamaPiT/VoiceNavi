/**
 * @file router.test.js
 * @description Router の単体テスト
 *
 * 【テスト方針（SW205 Section 3.2.2 検証条件対応）】
 * - isSafe: false の場合、VehicleUI / MusicUI が呼ばれないことを検証
 * - 未知のアクションがエラーをスローしないことを検証
 * - 各正常アクション（circulation_mode, play_music, show_info）が正しいモジュールを呼ぶことを検証
 */

import { jest } from "@jest/globals";
import { Router } from "../src/router.js";

/** モジュールのモックを生成する */
function createMocks() {
  const tts       = { speak: jest.fn() };
  const map       = { navigate: jest.fn(), searchAndSuggest: jest.fn(), showLandmarkInfo: jest.fn() };
  const vehicleUI = { apply: jest.fn() };
  const musicUI   = { play: jest.fn() };
  const showGuard = jest.fn();
  const updateChatLog = jest.fn();
  return { tts, map, vehicleUI, musicUI, showGuard, updateChatLog };
}

describe("Router.dispatch", () => {
  let mocks, router;

  beforeEach(() => {
    mocks = createMocks();
    router = new Router(mocks);
  });

  // ============================================================
  // ガードレール
  // ============================================================
  test("[ガードレール] isSafe=false の時、showGuard が呼ばれる", () => {
    router.dispatch({ isSafe: false, text: "できません", action: "navigate" });
    expect(mocks.showGuard).toHaveBeenCalled();
  });

  test("[ガードレール] isSafe=false の時、VehicleUI は呼ばれない", () => {
    router.dispatch({ isSafe: false, text: "できません", action: "circulation_mode" });
    expect(mocks.vehicleUI.apply).not.toHaveBeenCalled();
  });

  test("[ガードレール] isSafe=false の時、MusicUI は呼ばれない", () => {
    router.dispatch({ isSafe: false, text: "できません", action: "play_music" });
    expect(mocks.musicUI.play).not.toHaveBeenCalled();
  });

  // ============================================================
  // エラーオブジェクトのスキップ
  // ============================================================
  test("[異常系] エラーオブジェクトを受け取っても TTS を呼ばない", () => {
    router.dispatch({ error: "LLM_TIMEOUT" });
    expect(mocks.tts.speak).not.toHaveBeenCalled();
  });

  // ============================================================
  // 正常アクション
  // ============================================================
  test("[正常系] action=circulation_mode で VehicleUI.apply が呼ばれる", () => {
    router.dispatch({ isSafe: true, action: "circulation_mode", text: "内気循環にします" });
    expect(mocks.vehicleUI.apply).toHaveBeenCalledWith("circulation_mode", undefined);
  });

  test("[正常系] action=play_music で MusicUI.play が呼ばれる", () => {
    router.dispatch({ isSafe: true, action: "play_music", text: "かけますね", params: { title: "勝手にシンドバッド" } });
    expect(mocks.musicUI.play).toHaveBeenCalledWith("勝手にシンドバッド");
  });

  test("[正常系] action=show_info で Map.showLandmarkInfo が呼ばれる（立ち寄り提案なし）", () => {
    // Good Mellows通過案内: navigate_to は含まないこと
    router.dispatch({ isSafe: true, action: "show_info", text: "有名なハンバーガーショップです", params: { name: "Good Mellows" } });
    expect(mocks.map.showLandmarkInfo).toHaveBeenCalled();
    expect(mocks.map.navigate).not.toHaveBeenCalled();
  });

  test("[正常系] 各アクション後に TTS.speak が呼ばれる", () => {
    router.dispatch({ isSafe: true, action: "none", text: "こんにちは" });
    expect(mocks.tts.speak).toHaveBeenCalledWith("こんにちは");
  });

  // ============================================================
  // フォールセーフ: 未知のアクション
  // ============================================================
  test("[フォールセーフ] 未知の action はクラッシュしない", () => {
    expect(() => router.dispatch({ isSafe: true, action: "unknown_xyz", text: "テスト" })).not.toThrow();
  });
});
