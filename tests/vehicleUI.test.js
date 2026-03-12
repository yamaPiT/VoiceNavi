/**
 * @file vehicleUI.test.js
 * @description VehicleUIModule の単体テスト
 *
 * 【テスト方針（SW105 シナリオB・E 検証条件対応）】
 * - 各操作（temp_down, close_window, circulation_mode）が状態を正しく変更することを検証
 * - 未知の操作がクラッシュせずスキップされることを検証（フォールセーフ）
 * - 境界値: エアコン温度が 18〜30 の範囲を超えないことを検証
 */

import { VehicleUIModule } from "../src/vehicleUI.js";

describe("VehicleUIModule", () => {
  let vehicle;

  beforeEach(() => {
    // DOM要素なしでテスト（状態管理のみ確認）
    vehicle = new VehicleUIModule({});
  });

  // ============================================================
  // 初期状態
  // ============================================================
  test("[初期状態] 温度=25℃, 窓=開, 換気=外気導入", () => {
    const state = vehicle.getState();
    expect(state.temperature).toBe(25);
    expect(state.windowOpen).toBe(true);
    expect(state.circulationMode).toBe(false);
  });

  // ============================================================
  // エアコン操作
  // ============================================================
  test("[正常系] temp_down で温度が1下がる", () => {
    vehicle.apply("temp_down");
    expect(vehicle.getState().temperature).toBe(24);
  });

  test("[境界値] 温度が18℃の時 temp_down しても18℃のまま（最低値）", () => {
    for (let i = 0; i < 10; i++) vehicle.apply("temp_down");
    expect(vehicle.getState().temperature).toBe(18);
  });

  test("[境界値] 温度が30℃の時 temp_up しても30℃のまま（最高値）", () => {
    for (let i = 0; i < 10; i++) vehicle.apply("temp_up");
    expect(vehicle.getState().temperature).toBe(30);
  });

  // ============================================================
  // 窓操作
  // ============================================================
  test("[正常系] close_window で窓が閉まる", () => {
    vehicle.apply("close_window");
    expect(vehicle.getState().windowOpen).toBe(false);
  });

  test("[正常系] open_window で窓が開く", () => {
    vehicle.apply("close_window");
    vehicle.apply("open_window");
    expect(vehicle.getState().windowOpen).toBe(true);
  });

  // ============================================================
  // 換気モード（シナリオE: トラック排ガス回避）
  // ============================================================
  test("[正常系] circulation_mode で内気循環ONになる", () => {
    vehicle.apply("circulation_mode");
    expect(vehicle.getState().circulationMode).toBe(true);
  });

  test("[正常系] external_mode で外気導入に戻る", () => {
    vehicle.apply("circulation_mode");
    vehicle.apply("external_mode");
    expect(vehicle.getState().circulationMode).toBe(false);
  });

  // ============================================================
  // フォールセーフ: 未知のアクション
  // ============================================================
  test("[異常系] 未知の action はクラッシュせずスキップされる", () => {
    expect(() => vehicle.apply("unknown_action_xyz")).not.toThrow();
  });

  test("[異常系] 未知の action は状態を変更しない", () => {
    const before = vehicle.getState();
    vehicle.apply("unknown_action_xyz");
    expect(vehicle.getState()).toEqual(before);
  });
});
