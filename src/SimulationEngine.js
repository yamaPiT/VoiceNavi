import { INTERSECTION_NAMERIKAWA } from './ScenarioData.js';

/**
 * 自動走行の経路・速度計算を担うシミュレーションエンジン
 */
export class SimulationEngine {
  constructor(routePath, onTickCallback) {
    this.routePath = routePath || [];
    this.onTick = onTickCallback;

    this.state = 'idle'; // idle | running | paused
    this.speed = 0; // 現在速度 (km/h)
    this.targetSpeed = 50; // 走行中の目標速度（SW105: 最高速度50km/h）
    this.acceleration = 50 / 3; // 3秒間で0から50になる加速度 (km/h per sec)
    
    this.currentPathIndex = 0;
    this.progressToNextPoint = 0; // 0.0 to 1.0 の間で現在の線分上の位置を示す
    
    this.lastTickTime = 0;
    this.animationFrameId = null;

    this.currentPos = null;
    this.heading = 0; // 車両の進行方向（北を0度とした0-360）
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
    // 全体を50km/hでスムーズに流すようにする（SW105準拠）
    if (isApproachingEnd && this.progressToNextPoint > 0.5) {
      this.targetSpeed = 0; // 終点に向けて徐々に0へ
    } else {
      this.targetSpeed = 50;
      // なめりかわ交差点への接近判定
      if (this.currentPos) {
        const distToIntersection = this._calculateDistance(this.currentPos, INTERSECTION_NAMERIKAWA);
        // 交差点から半径80m以内の場合は10km/hに設定
        if (distToIntersection < 80) {
          this.targetSpeed = 10;
        }
      }
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
      this.heading = this._calculateHeading(p1, p2);
    } else {
      currentPos = this.routePath[this.routePath.length - 1]; // ゴール位置
    }
    this.currentPos = currentPos;

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

  /**
   * 2点間の進行方向（Heading）を計算する
   */
  _calculateHeading(p1, p2) {
    const lat1 = p1.lat * Math.PI / 180;
    const lat2 = p2.lat * Math.PI / 180;
    const lng1 = p1.lng * Math.PI / 180;
    const lng2 = p2.lng * Math.PI / 180;
    const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  /**
   * 2点間の距離(m)を計算する
   */
  _calculateDistance(p1, p2) {
    const R = 6371000; // 地球半径(m)
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(p1.lat*Math.PI/180)*Math.cos(p2.lat*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * 現在位置と進行方向を元に、周辺情報をLLM向きのテキストで生成する
   * @param {Array} landmarks 
   * @returns {string} 
   */
  getRelativeLandmarks(landmarks) {
    if (!this.currentPos || landmarks.length === 0) return "";
    
    let visibleItems = [];
    let approachingItems = [];
    let environmentInfo = "";

    // 環境情報の付与
    // 滑川交差点(lat: 35.30928) を基準に、どの道を走っているかを判定する
    if (this.currentPos) {
      if (this.currentPos.lat >= 35.3092 && this.heading > 150 && this.heading < 210) {
        // 滑川交差点より北側 ＆ 南下中（若宮大路）
        environmentInfo = "。現在、車の正面（前方）に「相模湾（海）」が広がっています。夕日が綺麗です。";
      } else if (this.currentPos.lat < 35.3100 && this.heading > 180 && this.heading < 300) {
        // 滑川交差点より南/西側 ＆ 西行中（134号線）
        environmentInfo = "。現在、車の左側の車窓には「相模湾（海）」が広がっています。夕日が綺麗です。";
      }
    }

    for (const lm of landmarks) {
      const targetPos = lm.position;
      const distance = this._calculateDistance(this.currentPos, targetPos);
      if (distance > 2000) continue; // 2km以上先は無視

      const bearing = this._calculateHeading(this.currentPos, targetPos);
      let relativeAngle = (bearing - this.heading + 360) % 360;
      
      let directionStr = "周辺";
      let isPassed = false;
      if (relativeAngle >= 315 || relativeAngle < 45) {
        directionStr = "前方";
      } else if (relativeAngle >= 45 && relativeAngle < 135) {
        directionStr = "右手";
      } else if (relativeAngle >= 135 && relativeAngle < 225) {
        directionStr = "後方";
        isPassed = true;
      } else if (relativeAngle >= 225 && relativeAngle < 315) {
        directionStr = "左手";
      }
      
      const distStr = `${Math.round(distance)}m`;
      const typeStr = lm.type ? `・${lm.type}` : "";
      if (distance <= 250) {
        visibleItems.push(`【可視(視程内)${typeStr}】${directionStr}${distStr}に「${lm.name}」`);
      } else if (!isPassed) {
        if (lm.type === "店舗" && distance > 700) {
          continue; // 店舗は700m以内になるまで存在を完全に隠蔽する
        }
        approachingItems.push({
          distance: distance,
          text: `【接近中${typeStr}】${directionStr}${distStr}先に「${lm.name}」`
        });
      } else {
        visibleItems.push(`【通過済み${typeStr}】${directionStr}${distStr}後方に「${lm.name}」`);
      }
    }
    
    // 【重要】接近中のランドマークは、距離でソートして「最も近い1件」のみを抽出する
    // これによりLLMが遠方の情報を拾って先回りしてしまう幻覚を物理的に防止する
    approachingItems.sort((a, b) => a.distance - b.distance);
    let topApproachingItems = [];
    if (approachingItems.length > 0) {
      topApproachingItems.push(approachingItems[0].text);
    }

    let contextStr = " 【リアルタイム周辺状況】: ";
    if (visibleItems.length > 0) contextStr += "視程内(250m以内)で見えるもの: " + visibleItems.join('、') + "。";
    if (topApproachingItems.length > 0) contextStr += "これから近づくもの(直近): " + topApproachingItems.join('、') + "。";
    contextStr += environmentInfo;

    return contextStr;
  }
}
