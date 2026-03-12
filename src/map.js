/**
 * @file map.js
 * @description 地図・走行シミュレーションモジュール
 *
 * 【目的】
 * Google Maps JavaScript API を用いてブラウザ上に地図とデモ用走行経路を描画し、
 * 自車位置マーカーを経路に沿って移動させるシミュレーションを実行する。
 *
 * 【設計決定（ADR-04参照）】
 * - 経路データは静的JSON（demoRoute.js）から読み込み、Directions API への依存を排除する
 * - waypoints が空または1点以下の場合はエラーを描画せず、デフォルト表示にフォールバックする
 * - シミュレーションはタイマーベース（setInterval）で自車マーカーをウェイポイント間で補完移動させる
 * - ランドマークのトリガー判定: 自車位置からランドマーク座標の距離を計算し
 *   triggerRadius 内に入った時点でコールバックを発火する
 */

import { DEMO_ROUTE } from "./data/demoRoute.js";

/** シミュレーション更新間隔（ms）。総所要時間をウェイポイント数で割る */
const SIM_INTERVAL_MS = (DEMO_ROUTE.estimatedMinutes * 60 * 1000) / Math.max(DEMO_ROUTE.waypoints.length - 1, 1);

export class MapModule {
  /**
   * @param {string} mapElementId - Google Mapsを描画するDOM要素のID
   * @param {function(string, Object): void} onLandmarkTrigger - ランドマーク発火コールバック
   *   (scenarioKey: string, landmark: Object) => void
   * @param {function(Object): void} onLocationUpdate - 位置更新コールバック
   *   ({ lat, lng, progress }) => void
   */
  constructor(mapElementId, onLandmarkTrigger = () => {}, onLocationUpdate = () => {}) {
    this.mapElementId = mapElementId;
    this.onLandmarkTrigger = onLandmarkTrigger;
    this.onLocationUpdate = onLocationUpdate;
    this.map = null;
    this.carMarker = null;
    this.polyline = null;
    this.simulationTimer = null;
    this.waypointIndex = 0;
    /** 発火済みランドマークIDのSet（1ランドマーク1回のみ発火） */
    this.triggeredLandmarks = new Set();
  }

  /**
   * Google Maps を初期化し、経路（ポリライン）とランドマークを描画する。
   * waypoints が空または1点以下の場合はエラー描画せず、中心のみ表示する（境界値）。
   */
  init() {
    if (typeof google === "undefined" || !google.maps) {
      console.warn("[Map] Google Maps API が読み込まれていません。地図機能を無効化します。");
      return;
    }

    this.map = new google.maps.Map(document.getElementById(this.mapElementId), {
      center: { lat: DEMO_ROUTE.start.lat, lng: DEMO_ROUTE.start.lng },
      zoom: 14,
      mapTypeId: "roadmap",
    });

    // 境界値チェック: waypoints が2点未満の場合はポリライン描画をスキップ
    if (DEMO_ROUTE.waypoints.length >= 2) {
      this.polyline = new google.maps.Polyline({
        path: DEMO_ROUTE.waypoints,
        geodesic: true,
        strokeColor: "#4285F4",
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map: this.map,
      });
    } else {
      console.warn("[Map] waypoints が2点未満のためポリライン描画をスキップします（フォールバック）。");
    }

    // 自車マーカー
    this.carMarker = new google.maps.Marker({
      position: DEMO_ROUTE.start,
      map: this.map,
      title: "自車位置",
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 5,
        fillColor: "#FF5722",
        fillOpacity: 1,
        strokeColor: "#FFF",
        strokeWeight: 1,
      },
    });

    // ランドマークマーカー
    DEMO_ROUTE.landmarks.forEach((lm) => {
      new google.maps.Marker({
        position: { lat: lm.lat, lng: lm.lng },
        map: this.map,
        title: lm.name,
        label: { text: lm.infoOnly ? "ℹ" : "★", color: "#333" },
      });
    });
  }

  /** 擬似走行シミュレーションを開始する */
  startSimulation() {
    if (DEMO_ROUTE.waypoints.length < 2) {
      console.warn("[Map] waypoints が2点未満のためシミュレーションを開始できません。");
      return;
    }
    this.waypointIndex = 0;
    this.simulationTimer = setInterval(() => this._step(), SIM_INTERVAL_MS);
  }

  /** 擬似走行シミュレーションを停止する */
  stopSimulation() {
    clearInterval(this.simulationTimer);
    this.simulationTimer = null;
  }

  /**
   * 地図上にランドマーク情報を一時的にポップアップ表示する。
   * @param {Object|null} params - { name: string, description: string } など
   */
  showLandmarkInfo(params) {
    if (!params || !this.map) return;
    console.info(`[Map] ランドマーク情報表示: ${params.name}`);
    // TODO: InfoWindow などで表示する実装を追加
  }

  /**
   * 経路を更新する（ナビゲーションアクション）。
   * @param {Object|null} params
   */
  navigate(params) {
    console.info("[Map] navigate:", params);
  }

  /**
   * 周辺施設を検索・提案する（search_places アクション）。
   * @param {Object|null} params
   */
  searchAndSuggest(params) {
    console.info("[Map] searchAndSuggest:", params);
  }

  // --- private ---

  /** シミュレーション1ステップ: 自車位置を次のウェイポイントへ移動する */
  _step() {
    if (this.waypointIndex >= DEMO_ROUTE.waypoints.length) {
      this.stopSimulation();
      return;
    }
    const wp = DEMO_ROUTE.waypoints[this.waypointIndex];
    const progress = this.waypointIndex / (DEMO_ROUTE.waypoints.length - 1);

    if (this.carMarker) this.carMarker.setPosition(wp);
    this.onLocationUpdate({ lat: wp.lat, lng: wp.lng, progress });

    // ランドマークトリガー判定
    DEMO_ROUTE.landmarks.forEach((lm) => {
      if (!this.triggeredLandmarks.has(lm.id)) {
        const dist = this._distanceMeters(wp.lat, wp.lng, lm.lat, lm.lng);
        if (dist <= lm.triggerRadius) {
          this.triggeredLandmarks.add(lm.id);
          this.onLandmarkTrigger(lm.scenario, lm);
        }
      }
    });

    this.waypointIndex++;
  }

  /**
   * 2点間の距離をメートル単位で計算するHaversine公式。
   * @returns {number} 距離（meters）
   * @private
   */
  _distanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
