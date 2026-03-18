/**
 * 自動走行の経路・速度計算を担うシミュレーションエンジン
 */
export class SimulationEngine {
  constructor(routePath, onTickCallback) {
    this.routePath = routePath || [];
    this.onTick = onTickCallback;

    this.state = 'idle'; // idle | running | paused
    this.speed = 0; // 現在速度 (km/h)
    this.targetSpeed = 40; // 走行中の目標速度
    this.acceleration = 40 / 3; // 3秒間で0から40になる加速度 (km/h per sec)
    
    this.currentPathIndex = 0;
    this.progressToNextPoint = 0; // 0.0 to 1.0 の間で現在の線分上の位置を示す
    
    this.lastTickTime = 0;
    this.animationFrameId = null;
  }

  /**
   * 後から経路をセットする
   */
  setRoutePath(path) {
    this.routePath = path || [];
    this.currentPathIndex = 0;
    this.progressToNextPoint = 0;
  }

  start() {
    if (this.state === 'running') return;
    this.state = 'running';
    this.lastTickTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.tick.bind(this));
  }

  pause() {
    this.state = 'paused';
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
  }

  stop() {
    this.state = 'idle';
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.speed = 0;
    this.currentPathIndex = 0;
    this.progressToNextPoint = 0;
  }

  /**
   * 毎フレーム呼ばれる更新処理
   * @param {number} currentTime 
   */
  tick(currentTime) {
    if (this.state !== 'running') return;

    const deltaMs = currentTime - this.lastTickTime;
    this.lastTickTime = currentTime;
    const deltaSec = deltaMs / 1000;

    // 次のポイントが終点（配列の最後）なら停止に向けて減速
    const isApproachingEnd = this.currentPathIndex >= this.routePath.length - 2;
    
    // OverviewPath等による多数のポイントがあるため、個々のポイントでの減速（交差点判定）は一旦無効化し
    // 全体を40km/hでスムーズに流すようにする
    if (isApproachingEnd && this.progressToNextPoint > 0.5) {
      this.targetSpeed = 0; // 終点に向けて徐々に0へ
    } else {
      this.targetSpeed = 40;
    }

    // 速度更新 (加減速ロジック: 1秒あたり acceleration 分変化)
    if (this.speed < this.targetSpeed) {
      this.speed += this.acceleration * deltaSec;
      if (this.speed > this.targetSpeed) this.speed = this.targetSpeed;
    } else if (this.speed > this.targetSpeed) {
      this.speed -= this.acceleration * deltaSec;
      if (this.speed < this.targetSpeed) this.speed = this.targetSpeed;
    }

    // 移動距離の計算
    // speed (km/h) を (m/s) に変換: speed * (1000 / 3600)
    // 緯度経度の「1度」は約 111,000m（概算）として、簡易的に緯度経度ベースの距離でprogressを進める
    // ※今回は地図表示デモ用の簡易計算
    const speedMs = this.speed * (1000 / 3600);
    const distanceMeters = speedMs * deltaSec;

    if (this.currentPathIndex < this.routePath.length - 1) {
      const p1 = this.routePath[this.currentPathIndex];
      const p2 = this.routePath[this.currentPathIndex + 1];
      
      // 2点間の距離(m)を簡易計算 (三平方の定理 * 111000)
      const distDegrees = Math.sqrt(Math.pow(p2.lat - p1.lat, 2) + Math.pow(p2.lng - p1.lng, 2));
      const segmentLengthMeters = distDegrees * 111000;
      
      // 今回のtickで進む割合
      const progressDelta = distanceMeters / segmentLengthMeters;
      this.progressToNextPoint += progressDelta;

      if (this.progressToNextPoint >= 1.0) {
        // 次の区間へ
        this.progressToNextPoint = 0;
        this.currentPathIndex++;
        
        if (this.currentPathIndex >= this.routePath.length - 1) {
          // ゴール到達
          this.speed = 0;
          this.state = 'idle';
        }
      }
    }

    // 現在座標の計算（線形補間）
    let currentPos = null;
    if (this.currentPathIndex < this.routePath.length - 1) {
      const p1 = this.routePath[this.currentPathIndex];
      const p2 = this.routePath[this.currentPathIndex + 1];
      currentPos = {
        lat: p1.lat + (p2.lat - p1.lat) * this.progressToNextPoint,
        lng: p1.lng + (p2.lng - p1.lng) * this.progressToNextPoint
      };
    } else {
      currentPos = this.routePath[this.routePath.length - 1]; // ゴール位置
    }

    // コールバックで状態を通知
    if (this.onTick) {
      this.onTick({
        state: this.state,
        speed: this.speed,
        position: currentPos,
        isFinished: this.state === 'idle'
      });
    }

    if (this.state === 'running') {
      this.animationFrameId = requestAnimationFrame(this.tick.bind(this));
    }
  }
}
