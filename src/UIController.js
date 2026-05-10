/**
 * @file UIController.js
 * @description 【DADAプロセス: 生きた仕様】UIのDOM要素管理および更新を行うコントローラークラス
 * 
 * 役割と責任:
 * 各種ボタン（開始、中断、再開、終了）や画面上の情報表示（速度、テキストログ、音楽再生インジケータ等）を制御する。
 * 発話例リストクリック等の誤操作防止や状態管理を行う。
 * 
 * 検証条件 (Acceptance Criteria):
 * UIイベント発火時、対応する内部モジュール（SimulationEngine 等）のメソッドが正しく呼ばれること。
 * 文字列のサニタイズ関数がSSMLタグをすべて除去すること。
 */
export class UIController {
  constructor() {
    this.speedValueEl = document.getElementById('speed-value');
    this.chatLogEl = document.getElementById('chat-log');
    this.btnStart = document.getElementById('btn-start');
    this.btnPause = document.getElementById('btn-pause');
    this.btnResume = document.getElementById('btn-resume');
    this.btnStop = document.getElementById('btn-stop');
    this.voiceStatusTextEl = document.getElementById('voice-status-text');
    this.voiceStatusEl = document.querySelector('.voice-status');
    
    this.btnToggleAuto = document.getElementById('btn-toggle-auto');
    this.musicIndicatorEl = document.getElementById('music-indicator');
    this.musicTitleEl = document.getElementById('music-title');
    this.musicTimer = null;
  }

  /**
   * SSMLタグを文字列から除去し、プレーンテキストにする
   * @param {string} text 
   * @returns {string}
   */
  sanitizeSSML(text) {
    if (!text) return "";
    // <speak>, <break>, <prosody> 等のタグを正規表現で除去
    return text.replace(/<[^>]+>/g, '').trim();
  }

  /**
   * 速度表示を更新する
   * @param {number} speed km/h
   */
  updateSpeed(speed) {
    this.speedValueEl.textContent = Math.round(speed);
  }

  /**
   * チャットログにメッセージを追加する
   * @param {string} speaker 'system', 'user', 'ai'
   * @param {string} text メッセージ本文
   */
  addChatMessage(speaker, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${speaker}-msg`;

    let speakerName = '';
    if (speaker === 'user') speakerName = 'ドライバー';
    else if (speaker === 'ai') speakerName = 'VoiceNavi';
    
    if (speakerName) {
      const label = document.createElement('div');
      label.className = 'speaker-label';
      label.textContent = speakerName;
      msgDiv.appendChild(label);
    }

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    
    // AIのメッセージの場合はSSMLをサニタイズする
    const displayText = (speaker === 'ai') ? this.sanitizeSSML(text) : text;
    bubble.textContent = displayText;
    
    msgDiv.appendChild(bubble);

    this.chatLogEl.appendChild(msgDiv);
    this.chatLogEl.scrollTop = this.chatLogEl.scrollHeight;
  }

  /**
   * 状態に応じてボタンの有効・無効を切り替える
   * @param {string} state 'idle' | 'running' | 'paused'
   */
  updateButtonStates(state) {
    switch(state) {
      case 'idle':
        this.btnStart.disabled = false;
        this.btnPause.disabled = true;
        this.btnResume.disabled = true;
        this.btnStop.disabled = true;
        break;
      case 'running':
        this.btnStart.disabled = true;
        this.btnPause.disabled = false;
        this.btnResume.disabled = true;
        this.btnStop.disabled = false;
        break;
      case 'paused':
        this.btnStart.disabled = true;
        this.btnPause.disabled = true;
        this.btnResume.disabled = false;
        this.btnStop.disabled = false;
        break;
    }
  }

  /**
   * マイクや音声合成の状態UIを更新する
   * @param {string} state 'idle', 'listening', 'speaking'
   */
  updateVoiceStatus(state) {
    this.voiceStatusEl.className = 'voice-status'; // reset
    if (state === 'listening') {
      this.voiceStatusEl.classList.add('listening');
      this.voiceStatusTextEl.textContent = '認識中...';
    } else if (state === 'speaking') {
      this.voiceStatusEl.classList.add('speaking');
      this.voiceStatusTextEl.textContent = '発話中';
    } else {
      this.voiceStatusTextEl.textContent = '待機中';
    }
  }

  /**
   * 音楽インジケーターを表示する
   * @param {string} title 
   */
  showMusicIndicator(title) {
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
    }
    
    this.musicTitleEl.textContent = title || "サザンオールスターズ - 勝手にシンドバッド";
    this.musicIndicatorEl.classList.remove('hidden');

    // デモ用として150秒間表示（Masa要求）
    this.musicTimer = setTimeout(() => {
      this.hideMusicIndicator();
    }, 150000);
  }

  /**
   * 音楽インジケーターを非表示にする
   */
  hideMusicIndicator() {
    this.musicIndicatorEl.classList.add('hidden');
  }

  /**
   * 自律発話トグルスイッチの表示を更新する
   */
  updateAutoToggle(isEnabled) {
    if (!this.btnToggleAuto) return;
    
    // チェックボックス自体の状態更新
    if (this.btnToggleAuto.type === 'checkbox') {
      this.btnToggleAuto.checked = isEnabled;
    }

    // ラベルの視覚効果を更新
    const lblOff = document.getElementById('toggle-status-off');
    const lblOn = document.getElementById('toggle-status-on');
    
    if (lblOff && lblOn) {
      if (isEnabled) {
        lblOn.classList.add('on');
        lblOff.classList.remove('off');
        lblOff.style.color = "var(--text-secondary)";
      } else {
        lblOn.classList.remove('on');
        lblOff.classList.add('off'); // 強調色適用
        lblOff.style.color = "var(--text-primary)";
      }
    }
  }

  get isMusicPlaying() {
    return !this.musicIndicatorEl.classList.contains('hidden');
  }
}
