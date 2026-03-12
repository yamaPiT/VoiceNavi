/**
 * @file main.js
 * @description アプリケーション初期化・モジュール組み立て（DI）
 *
 * 【目的】
 * 各モジュール（STT・TTS・LLM・Map・VehicleUI・MusicUI・ContextStore・Router）を
 * インスタンス化し、依存関係を注入（Dependency Injection）してアプリを起動する。
 *
 * 【設計決定（ADR-02参照）】
 * - 各モジュールはこのファイルでのみインスタンス化し、互いの参照はRouter経由に限定する
 * - APIキーは window.ENV から読み込む（index.html でセットされる）
 *
 * 【Autonomous Feedback Loop】
 * - LLM遅延検知（4.9秒）→ 繋ぎ音声
 * - LLMエラー・JSONパースエラー → リトライカウンタインクリメント
 * - 3回連続失敗 → ContextStore リセット → 初期状態へ
 */

import { ContextStore } from "./contextStore.js";
import { STTModule } from "./stt.js";
import { TTSModule } from "./tts.js";
import { LLMModule } from "./llm.js";
import { Router } from "./router.js";
import { MapModule } from "./map.js";
import { VehicleUIModule } from "./vehicleUI.js";
import { MusicUIModule } from "./musicUI.js";
import { SYSTEM_PROMPT } from "./data/systemPrompt.js";

/** 最大リトライ回数（境界値: 3回で初期状態へ） */
const MAX_RETRY = 3;

/** チャットログ要素 */
let chatLogEl;

/**
 * チャットログにメッセージを追加する。
 * @param {{ role: string, content: string, isSafe?: boolean }} msg
 */
function updateChatLog(msg) {
  if (!chatLogEl) return;
  const div = document.createElement("div");
  div.className = `chat-msg chat-msg--${msg.role}${msg.isSafe === false ? " chat-msg--guard" : ""}`;
  div.textContent = `${msg.role === "user" ? "👤" : "🤖"} ${msg.content}`;
  chatLogEl.appendChild(div);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

/**
 * ガードレール発動時のUI表示。
 * @param {string} message
 */
function showGuard(message) {
  const guardEl = document.getElementById("guard-notification");
  if (guardEl) {
    guardEl.textContent = `⚠️ ${message}`;
    guardEl.style.display = "block";
    setTimeout(() => { guardEl.style.display = "none"; }, 5000);
  }
}

/** アプリケーションのメイン初期化関数 */
function init() {
  chatLogEl = document.getElementById("chat-log");
  const env = window.ENV || {};

  // --- モジュール初期化 ---

  const tts = new TTSModule();

  const musicUI = new MusicUIModule({
    carIcon: document.getElementById("car-icon"),
    musicBubble: document.getElementById("music-bubble"),
  });

  const vehicleUI = new VehicleUIModule({
    tempDisplay: document.getElementById("vehicle-temp"),
    windowStatus: document.getElementById("vehicle-window"),
    ventStatus: document.getElementById("vehicle-vent"),
  });

  const map = new MapModule(
    "map",
    // ランドマークトリガー: LLMにシナリオキーを伝えてプロアクティブ発話を促す
    async (scenarioKey, landmark) => {
      console.info(`[Main] ランドマーク発火: ${scenarioKey} - ${landmark.name}`);
      const proactivePrompt = `[システムトリガー] 現在、${landmark.name}付近を通過中。シナリオ「${scenarioKey}」を自然に会話に組み込んでください。`;
      await handleUserInput(proactivePrompt, llm, router);
    },
    // 位置更新: ContextStoreに現在地を反映
    ({ lat, lng, progress }) => {
      ContextStore.updateLocation({ lat, lng }, progress);
    }
  );

  const llm = new LLMModule(
    env.GEMINI_API_KEY || "",
    env.GEMINI_MODEL || "gemini-2.0-flash",
    SYSTEM_PROMPT,
    // 遅延検知コールバック: 4.9秒超過で繋ぎ音声を再生
    (delayText) => {
      tts.speak(delayText);
      console.info("[Main] 遅延検知: 繋ぎ音声を再生");
    }
  );

  const router = new Router({ tts, map, vehicleUI, musicUI, showGuard, updateChatLog });

  const stt = new STTModule(async (text) => {
    updateChatLog({ role: "user", content: text });
    ContextStore.addHistory("user", text);
    await handleUserInput(text, llm, router);
  });

  // --- UIイベント設定 ---

  const micBtn = document.getElementById("mic-btn");
  if (micBtn) {
    micBtn.addEventListener("click", () => {
      stt.start();
      micBtn.textContent = "🎤 聞いています...";
      micBtn.disabled = true;
      setTimeout(() => {
        micBtn.textContent = "🎤 話しかける";
        micBtn.disabled = false;
      }, 6000);
    });
  }

  const stopMusicBtn = document.getElementById("stop-music-btn");
  if (stopMusicBtn) {
    stopMusicBtn.addEventListener("click", () => {
      musicUI.stop();
      ContextStore.setMusicPlaying(false);
    });
  }

  // --- Google Maps 初期化 ---
  map.init();
  map.startSimulation();

  console.info("[VoiceNavi] 初期化完了。ショウヘイとマミコのドライブを開始します！");
}

/**
 * ユーザー入力（またはシステムトリガー）をLLMに送り、Routerに振り分ける。
 * Autonomous Feedback Loop（エラー時リトライ・3回失敗で初期化）を実装。
 *
 * @param {string} text - ユーザー発話またはシステムプロアクティブプロンプト
 * @param {LLMModule} llm
 * @param {Router} router
 */
async function handleUserInput(text, llm, router) {
  const response = await llm.send(text);

  if (response.error) {
    // LLMエラー: リトライカウンタをインクリメント
    ContextStore.incrementRetry();
    console.warn(`[Main] LLMエラー: ${response.error} (リトライ: ${ContextStore.getRetryCount()}/${MAX_RETRY})`);

    if (ContextStore.getRetryCount() >= MAX_RETRY) {
      // 3回連続失敗: 初期状態へリセット（境界値）
      ContextStore.reset();
      const resetText = "申し訳ありません。初めからやり直してください。";
      router.dispatch({ action: "none", text: resetText, isSafe: true, target: "driver" });
    } else {
      // リトライ: 聞き返し
      const retryText = "もう一度お願いできますか？";
      router.dispatch({ action: "none", text: retryText, isSafe: true, target: "driver" });
    }
    return;
  }

  // 正常応答: リトライカウンタリセット
  ContextStore.resetRetry();
  ContextStore.addHistory("assistant", response.text || "");

  // 音楽再生状態を ContextStore に同期
  if (response.action === "play_music") ContextStore.setMusicPlaying(true);

  router.dispatch(response);
}

// DOMが準備できたら初期化
document.addEventListener("DOMContentLoaded", init);
