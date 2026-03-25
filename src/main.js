import { UIController } from './UIController.js';
import { SimulationEngine } from './SimulationEngine.js';
import { MapModule } from './MapModule.js';
import { VoiceInteractionModule } from './VoiceInteractionModule.js';
import { LLMAgent } from './LLMAgent.js';
import { ROUTE_ORIGIN, ROUTE_DESTINATION, ROUTE_WAYPOINTS, LANDMARKS, SYSTEM_PROMPT, ROUTE_CONTEXT } from './ScenarioData.js';

// ---- Environment Variables (Vite) ----
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_CLOUD_TTS_API_KEY = import.meta.env.VITE_GOOGLE_CLOUD_TTS_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

class Application {
  constructor() {
    this.ui = new UIController();
    this.mapModule = new MapModule('map');
    this.simulation = new SimulationEngine([], this.onSimulationTick.bind(this));
    
    // API Request Modules
    this.voiceModule = new VoiceInteractionModule(GOOGLE_CLOUD_TTS_API_KEY);
    this.llmAgent = new LLMAgent(GEMINI_API_KEY, SYSTEM_PROMPT);

    this.isDemoActive = false;
    this.isListeningWait = false; 
    this.isArrivalAnnounced = false; 
    this.isAutonomousEnabled = true; // デフォルトON
    this.lastInteractionTime = Date.now();
    this.lastResponseText = "";

    // 初回ロード
    this.init();
  }

  async init() {
    // API Key Validation
    if (!GOOGLE_MAPS_API_KEY || !GEMINI_API_KEY || !GOOGLE_CLOUD_TTS_API_KEY) {
      this.ui.addChatMessage('system', 'エラー: 必要なAPIキーが .env に設定されていません。機能が制限されます。');
    }

    try {
      // 1. 地図の初期化（APIロードと初期表示）
      await this.mapModule.init(GOOGLE_MAPS_API_KEY, LANDMARKS);
      
      // 2. 詳細なルートパスの取得と描画
      const detailedPath = await this.mapModule.calculateRoute(ROUTE_ORIGIN, ROUTE_DESTINATION, ROUTE_WAYPOINTS);
      this.mapModule.drawRoute(detailedPath);
      
      // 3. シミュレーションへ新しいパスを適用
      this.simulation.setRoutePath(detailedPath);
      if (detailedPath.length > 1) {
         this.mapModule.updateCarPosition(detailedPath[0], detailedPath[1]);
      }

      this.ui.updateButtonStates('idle');
      this.bindEvents();
      this.ui.addChatMessage('system', '初期化完了。機能を利用には画面のどこかをクリックして音声再生を許可してください。');
      
      // ブラウザの音声再生ブロックを解除するためのユーザアクション
      document.addEventListener('click', () => {
         // Dummy audio to unlock AudioContext
      }, { once: true });

    } catch(err) {
      console.error(err);
      this.ui.addChatMessage('system', '地図の初期化に失敗しました。APIキーを確認してください。');
    }
  }

  bindEvents() {
    this.ui.btnStart.addEventListener('click', () => this.startDemo());
    this.ui.btnPause.addEventListener('click', () => this.pauseDemo());
    this.ui.btnResume.addEventListener('click', () => this.resumeDemo());
    this.ui.btnStop.addEventListener('click', () => this.stopDemo());
    this.ui.btnToggleAuto.addEventListener('change', (e) => {
       this.isAutonomousEnabled = e.target.checked;
       this.ui.updateAutoToggle(this.isAutonomousEnabled);
    });

    // シナリオリストのクリックイベント（Phase 3より参考用とし、クリック無効化）
    /*
    const scenarioItems = document.querySelectorAll('.scenario-item');
    ...
    */
  }

  // --- デモの制御 ---
  startDemo() {
    this.simulation.start();
    this.ui.updateButtonStates('running');
    this.ui.addChatMessage('system', 'デモを開始しました。マイクへのアクセスを許可し、話しかけてください。');
    this.isDemoActive = true;
    this.isArrivalAnnounced = false; 
    this.ui.updateAutoToggle(this.isAutonomousEnabled); // UI初期化
    this.continuousListenLoop(); // 音声認識ループ開始
  }

  pauseDemo() {
    this.simulation.pause();
    this.ui.updateButtonStates('paused');
    this.ui.addChatMessage('system', 'デモを中断しました。');
    this.isDemoActive = false; 
  }

  resumeDemo() {
    this.simulation.start();
    this.ui.updateButtonStates('running');
    this.ui.addChatMessage('system', 'デモを再開しました。');
    this.isDemoActive = true;
    this.continuousListenLoop();
  }

  stopDemo() {
    this.simulation.stop();
    // スタート地点に戻す
    const currentPath = this.simulation.routePath;
    if (currentPath.length > 1) {
       this.mapModule.updateCarPosition(currentPath[0], currentPath[1]);
    }
    this.ui.updateButtonStates('idle');
    this.ui.updateSpeed(0);
    this.ui.addChatMessage('system', 'デモを終了し、初期位置に戻りました。');
    this.isDemoActive = false;
  }

  // --- シミュレーション更新コールバック ---
  onSimulationTick(data) {
    this.ui.updateSpeed(data.speed);

    // 次の目標座標がある場合は渡して車の向きを制御
    let nextPos = null;
    let currPos = data.position;
    
    const currentPath = this.simulation.routePath;

    if (this.simulation.currentPathIndex < currentPath.length - 1) {
       nextPos = currentPath[this.simulation.currentPathIndex + 1];
    } else if (this.simulation.currentPathIndex === currentPath.length - 1 && currentPath.length > 1) {
       // ゴール時は直前の向きを維持
       currPos = currentPath[currentPath.length - 2];
       nextPos = currentPath[currentPath.length - 1];
       this.mapModule.updateCarPosition(data.position, nextPos);
       // 向き計算のためにあえて直前とゴールを渡すが、表示位置は現在位置
       this.mapModule.carMarker.setPosition(data.position);
       
    }

    if(nextPos) {
       this.mapModule.updateCarPosition(data.position, nextPos);
    }
    
    if (data.isFinished && !this.isArrivalAnnounced) {
      this.isArrivalAnnounced = true;
      this.ui.updateSpeed(0);
      // 到着時は自律的な介入（割り込み）として処理
      this.triggerAutonomousGuidance("目的地に到着しました。到着の案内をお願いします。");
    }

    // 自律発話（無言時のガイド）: 60秒ごとにトリガー（クォータ節約のため30sから延長）
    if (this.isDemoActive && this.isAutonomousEnabled && !this.isListeningWait && !this.voiceModule.isPlaying) {
      const now = Date.now();
      if (now - this.lastInteractionTime > 60000) {
        // 音楽再生中の場合は、音楽提案を含む自律発話をスキップする
        if (this.ui.isMusicPlaying) {
           console.log("[DEBUG] Music is playing. Skipping autonomous guidance trigger.");
           return;
        }
        console.log("[DEBUG] Autonomous speech triggered.");
        this.triggerAutonomousGuidance();
      }
    }
  }

  async triggerAutonomousGuidance(customText = "") {
    this.lastInteractionTime = Date.now();
    
    // 強制的にリスニングを中断して処理へ回す（自らの発話を拾わないようにする）
    if (this.voiceModule.recognition && this.isListeningWait) {
       this.voiceModule.recognition.stop();
    }
    this.isListeningWait = true;
    this.ui.updateVoiceStatus('idle');

    // customTextがあればそれを使う（到着時など）、なければ空（自律ガイド）
    await this.handleUserUtterance(customText, true);
  }

  // --- 音声と対話の処理ループ ---
  async continuousListenLoop() {
    if (!this.isDemoActive || this.isListeningWait) return;
    
    this.isListeningWait = true;
    this.ui.updateVoiceStatus('listening');

    try {
      // ユーザーの音声を待機
      const userText = await this.voiceModule.listen();

      this.isListeningWait = false;
      
      if (userText && userText.trim().length > 0) {
        this.ui.addChatMessage('user', userText);
        this.ui.updateVoiceStatus('idle');
        await this.handleUserUtterance(userText);
      } else {
        // 無音の場合すぐ再開
        if(this.isDemoActive) setTimeout(() => this.continuousListenLoop(), 500);
      }
    } catch (e) {
      this.isListeningWait = false;
      console.warn("STT Loop warning:", e);
      if(this.isDemoActive) setTimeout(() => this.continuousListenLoop(), 1000);
    }
  }

  // --- マニュアル（クリックによる）発話トリガー ---
  async triggerManualUtterance(text) {
    if (!this.isDemoActive) return; // 割り込み優先
    
    // 強制的にリスニングを中断して処理へ回す
    if (this.voiceModule.recognition && this.isListeningWait) {
       this.voiceModule.recognition.stop();
    }
    
    this.isListeningWait = true;
    this.ui.addChatMessage('user', text);
    this.ui.updateVoiceStatus('idle');
    await this.handleUserUtterance(text);
  }

  async handleUserUtterance(text, isAutonomous = false) {
    // 応答遅延時（5秒）のフォールバック用コールバック
    const onDelay = () => {
      this.ui.addChatMessage('ai', '（考え中...）');
      // フィラー音声「ちょっとまってね」は削除（Masa要求）
    };

    try {
      this.ui.updateVoiceStatus('speaking');
      
      // 現在の進行比率からコンテキスト状況を取得
      const pathLength = this.simulation.routePath.length;
      let progressRatio = 0;
      if (pathLength > 0) {
        progressRatio = this.simulation.currentPathIndex / pathLength;
      }
      const contextIndex = Math.min(
        Math.floor(progressRatio * ROUTE_CONTEXT.length),
        ROUTE_CONTEXT.length - 1
      );
      let currentContext = ROUTE_CONTEXT[contextIndex] || "ドライブ中";
      
      // シミュレーションエンジンが算出するリアルタイムの相対位置（前後左右）情報を動的に付与
      if (this.isDemoActive) {
         currentContext += this.simulation.getRelativeLandmarks(LANDMARKS);
         currentContext += ` 【走行状態】: 現在${this.ui.isMusicPlaying ? '音楽を再生中' : '音楽は流れていない'}。`;
      }

      // 意図抽出・応答生成
      let contextPrefix = isAutonomous ? "【自律発話のタイミング】" : "";
      
      // 音楽再生の自律的ルール（Masa要求）
      if (isAutonomous) {
         if (progressRatio < 0.75) {
            contextPrefix += "（現在は稲村ヶ崎の通過前です。もし自律的に音楽を流すならサザン以外の湘南に合う曲にしてください）";
         } else {
            contextPrefix += "（現在は稲村ヶ崎を通過中または通過後です。自律的にサザンの曲を解禁します）";
         }
      }

      const responseJSON = await this.llmAgent.processInput(contextPrefix + text, currentContext, onDelay);

      if (!responseJSON) {
        this.ui.updateVoiceStatus('idle');
        this.isListeningWait = false;
        this.continuousListenLoop();
        return;
      }

      // 重複発話のチェック（自律発話時のみスキップ判定）
      const cleanText = responseJSON.reply_text.trim();
      if (isAutonomous && cleanText === this.lastResponseText) {
        console.log("[DEBUG] Skipping duplicate autonomous speech:", cleanText);
        this.ui.updateVoiceStatus('idle');
        this.isListeningWait = false; 
        this.continuousListenLoop();
        return;
      }
      this.lastResponseText = cleanText;
      this.lastInteractionTime = Date.now();

      // 画面表示用にSSMLタグを除去
      const displayPlainText = responseJSON.reply_text.replace(/<[^>]+>/g, '');
      this.ui.addChatMessage('ai', displayPlainText);

      // ランドマーク点滅処理
      if (responseJSON.target_landmark_id && responseJSON.target_landmark_id !== 'none') {
        this.mapModule.highlightLandmark(responseJSON.target_landmark_id);
      }

      // 車両アクション等のUI処理
      const actions = Array.isArray(responseJSON.action) ? responseJSON.action : [responseJSON.action];

      if (actions.includes('play_music')) {
        const musicTitle = responseJSON.music_title || "サザンオールスターズ - 勝手にシンドバッド";
        this.ui.showMusicIndicator(musicTitle);
      }
      
      if (actions.includes('circulation_mode')) {
        this.ui.addChatMessage('system', '【車両制御】窓を閉めて内気循環モードに変更しました');
      }

      // 自己修復フェーズでの失敗確認
      if (responseJSON._isFallback && responseJSON._isFallback === true) {
         this.ui.addChatMessage('system', '【システム警告】エージェントが意図の解析に継続して失敗しました。');
      }

      // TTSで発話
      await this.voiceModule.speak(
        responseJSON.reply_text,
        () => { this.ui.updateVoiceStatus('speaking'); },
        () => { 
          this.ui.updateVoiceStatus('idle');
          if(this.isDemoActive) {
            this.isListeningWait = false;
            setTimeout(() => this.continuousListenLoop(), 500);
          }
        }
      );

    } catch (err) {
      console.error(err);
      this.ui.addChatMessage('system', '対話処理中にエラーが発生しました。');
      this.ui.updateVoiceStatus('idle');
      if(this.isDemoActive) {
        this.isListeningWait = false;
        setTimeout(() => this.continuousListenLoop(), 1000);
      }
    }
  }
}

// 初期化
window.onload = () => {
  new Application();
};
