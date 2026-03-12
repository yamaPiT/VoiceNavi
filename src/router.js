/**
 * @file router.js
 * @description Router / UIController モジュール
 *
 * 【目的】
 * LLMモジュールから受け取ったJSONレスポンス（LLMResponse）を解析し、
 * action の値に応じて適切なモジュールへ処理を振り分ける。
 * 全モジュール間の唯一の通信ハブとして機能し、モジュールの疎結合を保証する。
 *
 * 【設計決定（ADR-02参照）】
 * - 中央Routerパターン採用。各モジュールはRouterのみを知り、互いに直接参照しない
 * - isSafe: false の場合はガードレール発動し、action の実行を完全にスキップする
 * - action が未知の値でも例外をスローせず、ログのみ出力してスキップする（フォールセーフ）
 */

export class Router {
  /**
   * @param {Object} modules - 各モジュールの参照
   * @param {import("./tts.js").TTSModule} modules.tts
   * @param {import("./map.js").MapModule} modules.map
   * @param {import("./vehicleUI.js").VehicleUIModule} modules.vehicleUI
   * @param {import("./musicUI.js").MusicUIModule} modules.musicUI
   * @param {function(string): void} modules.showGuard - ガードレールUI表示関数
   * @param {function(Object): void} modules.updateChatLog - チャットログ更新関数
   */
  constructor(modules) {
    this.tts = modules.tts;
    this.map = modules.map;
    this.vehicleUI = modules.vehicleUI;
    this.musicUI = modules.musicUI;
    this.showGuard = modules.showGuard;
    this.updateChatLog = modules.updateChatLog;
  }

  /**
   * LLMレスポンスを受け取り、各モジュールへ振り分ける。
   *
   * @param {import("./llm.js").LLMResponse} llmResponse - LLMモジュールの出力
   */
  dispatch(llmResponse) {
    // エラーオブジェクトの場合は処理をスキップ
    if (llmResponse.error) {
      console.warn(`[Router] LLMエラー受信: ${llmResponse.error}`);
      return;
    }

    // ガードレール判定: isSafe === false の場合、action を無視して拒否メッセージを表示
    if (llmResponse.isSafe === false) {
      this.showGuard(llmResponse.text || "申し訳ありませんが、その要求にはお応えできません。");
      this.tts.speak(llmResponse.text || "申し訳ありませんが、その要求にはお応えできません。");
      this.updateChatLog({ role: "assistant", content: llmResponse.text, isSafe: false });
      return;
    }

    // action に応じてモジュールを呼び出す
    // 未知の action 値はスキップ（フォールセーフ）
    switch (llmResponse.action) {
      case "navigate":
        this.map.navigate(llmResponse.params);
        break;

      case "search_places":
        this.map.searchAndSuggest(llmResponse.params);
        break;

      case "show_info":
        // 立ち寄り提案なしの情報提供のみ（Good Mellows 通過案内等）
        this.map.showLandmarkInfo(llmResponse.params);
        break;

      case "temp_down":
      case "close_window":
      case "circulation_mode":
        // 車両操作UI: エアコン・窓・換気モードの擬似制御
        this.vehicleUI.apply(llmResponse.action, llmResponse.params);
        break;

      case "play_music":
        // 著作権対応: 音声再生なし、UIアニメーションのみ
        this.musicUI.play(llmResponse.params?.title ?? "");
        break;

      case "guard":
        // LLMが明示的に guard アクションを返した場合（isSafe チェックとは別の経路）
        this.showGuard(llmResponse.text);
        break;

      case "none":
      default:
        // 何もしない（雑談応答等）
        if (llmResponse.action !== "none") {
          console.warn(`[Router] 未知の action: "${llmResponse.action}" - スキップします`);
        }
        break;
    }

    // TTSで応答テキストを読み上げる（ガードレール以外の全アクションで実行）
    if (llmResponse.text) {
      this.tts.speak(llmResponse.text);
      this.updateChatLog({ role: "assistant", content: llmResponse.text });
    }
  }
}
