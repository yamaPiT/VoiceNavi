/**
 * @file vehicleUI.js
 * @description 車両擬似操作UIモジュール
 *
 * 【目的】
 * エアコン温度・窓の開閉・換気モードなどの車両操作を「デモ上で実行した」として
 * UIに反映する。実際の車両制御は行わない（擬似デモ）。
 *
 * 【設計決定】
 * - 各操作は DOM 要素へのクラス/テキスト変更として表現する
 * - apply() は action 文字列を受け取ることで、Router から単一インターフェースで呼び出せる
 * - 未知の action はエラーを投げず、ログ出力のみでスキップする（フォールセーフ）
 */

export class VehicleUIModule {
  /**
   * @param {Object} elements - UIのDOM要素参照
   * @param {HTMLElement} elements.tempDisplay - エアコン温度表示要素
   * @param {HTMLElement} elements.windowStatus - 窓の状態表示要素
   * @param {HTMLElement} elements.ventStatus - 換気モード表示要素
   */
  constructor(elements = {}) {
    this.elements = elements;
    /** @type {Object} 現在の車両状態 */
    this.state = {
      temperature: 25,          // エアコン設定温度（デフォルト25℃）
      windowOpen: true,         // 窓の開閉状態
      circulationMode: false,   // 内気循環モード（true: 内気 / false: 外気）
    };
  }

  /**
   * 車両操作アクションを適用する。
   * Routerから呼ばれる統一インターフェース。
   *
   * @param {string} action - 操作種別
   * @param {Object|null} params - 操作パラメータ
   */
  apply(action, params = null) {
    switch (action) {
      case "temp_down":
        this._tempDown();
        break;
      case "temp_up":
        this._tempUp();
        break;
      case "close_window":
        this._closeWindow();
        break;
      case "open_window":
        this._openWindow();
        break;
      case "circulation_mode":
        this._setCirculationMode(true);
        break;
      case "external_mode":
        this._setCirculationMode(false);
        break;
      default:
        // 未知の操作はスキップ（定義済み操作のみ実行するフォールセーフ）
        console.warn(`[VehicleUI] 未知の操作: "${action}" - スキップします`);
        break;
    }
    this._updateDisplay();
  }

  /** @returns {Object} 現在の車両状態スナップショット */
  getState() { return { ...this.state }; }

  // --- private actions ---

  _tempDown() {
    this.state.temperature = Math.max(18, this.state.temperature - 1);
  }

  _tempUp() {
    this.state.temperature = Math.min(30, this.state.temperature + 1);
  }

  _closeWindow() {
    this.state.windowOpen = false;
  }

  _openWindow() {
    this.state.windowOpen = true;
  }

  _setCirculationMode(isInternal) {
    this.state.circulationMode = isInternal;
  }

  /** 状態をDOM要素に反映する */
  _updateDisplay() {
    if (this.elements.tempDisplay) {
      this.elements.tempDisplay.textContent = `${this.state.temperature}℃`;
    }
    if (this.elements.windowStatus) {
      this.elements.windowStatus.textContent = this.state.windowOpen ? "開" : "閉";
    }
    if (this.elements.ventStatus) {
      this.elements.ventStatus.textContent = this.state.circulationMode ? "内気循環" : "外気導入";
    }
  }
}
