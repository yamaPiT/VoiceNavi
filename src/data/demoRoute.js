/**
 * @file demoRoute.js
 * @description デモ走行経路とランドマークの静的データ
 *
 * 【目的】
 * Google Maps Directions API への依存をなくし、ネットワーク不要でテスト・デモを実行可能にする。
 * 経路データはPOI（ランドマーク）のトリガー半径（meters）を持ち、
 * MapModule が自車位置との距離を計算してシナリオを自動発火する。
 *
 * 【経路概要】
 * 鎌倉駅（出発）→ 若宮大路（鶴岡八幡宮参道）→ 滑川交差点右折 →
 * 国道134号 由比ヶ浜 → 稲村ヶ崎 → 七里ヶ浜海岸駐車場（目的地）
 * 総距離: 約4.87km / 所要時間: 約7分（45km/h、全信号青想定）
 */

export const DEMO_ROUTE = {
  name: "鎌倉→七里ヶ浜コース",
  description: "鎌倉駅から鶴岡八幡宮参道を抜け、七里ヶ浜海岸駐車場へ向かうルート",
  totalDistanceKm: 4.87,
  estimatedMinutes: 7,
  speedKmh: 45,

  /** 出発地 */
  start: { name: "鎌倉駅", lat: 35.3197, lng: 139.5503 },

  /** 目的地 */
  goal:  { name: "七里ヶ浜海岸駐車場（鎌倉側）", lat: 35.3045, lng: 139.5099 },

  /**
   * ルート上の中間座標。
   * MapModule がこれを元にポリラインを描画し、自車を等速で移動させる。
   * 境界値: 空配列の場合は直線ルートにフォールバックする。
   */
  waypoints: [
    { lat: 35.3197, lng: 139.5503 }, // 鎌倉駅
    { lat: 35.3230, lng: 139.5530 }, // 若宮大路 北
    { lat: 35.3200, lng: 139.5545 }, // 若宮大路 中央
    { lat: 35.3162, lng: 139.5553 }, // 若宮大路 南（滑川付近）
    { lat: 35.3148, lng: 139.5540 }, // 滑川交差点（右折）
    { lat: 35.3140, lng: 139.5490 }, // 由比ヶ浜 東
    { lat: 35.3121, lng: 139.5382 }, // 由比ヶ浜 中央（Good Mellows付近）
    { lat: 35.3105, lng: 139.5280 }, // 由比ヶ浜 西
    { lat: 35.3082, lng: 139.5195 }, // 稲村ヶ崎
    { lat: 35.3065, lng: 139.5173 }, // 稲村ヶ崎展望点
    { lat: 35.3055, lng: 139.5120 }, // 七里ヶ浜（Double Doors付近）
    { lat: 35.3045, lng: 139.5099 }, // 七里ヶ浜海岸駐車場（目的地）
  ],

  /**
   * ランドマーク定義。
   * MapModule が自車位置から triggerRadius 内に入ったタイミングで
   * LLM にシナリオのトリガー情報を渡す。
   */
  landmarks: [
    {
      id: "hachimangu",
      name: "鶴岡八幡宮",
      lat: 35.3260, lng: 139.5564,
      triggerRadius: 400,    // meters
      scenario: "mental_map_hachimangu",  // シナリオAの発火キー
      description: "若宮大路（参道）の北端。出発直後に後方に見える。",
    },
    {
      id: "namerikawa",
      name: "滑川交差点",
      lat: 35.3148, lng: 139.5540,
      triggerRadius: 100,
      scenario: "mental_map_namerikawa",
      description: "橋は渡らず右折。左手に滑川が見える。東が材木座海岸、西が由比ヶ浜。",
    },
    {
      id: "good_mellows",
      name: "Good Mellows",
      lat: 35.3121, lng: 139.5382,
      triggerRadius: 150,
      scenario: "info_good_mellows",
      infoOnly: true,   // 立ち寄り提案なし。情報提供のみ（Good Mellows専用フラグ）
      description: "湘南の超有名本格ハンバーガーショップ。クラシックスタイルで行列必至。",
    },
    {
      id: "inamuragasaki",
      name: "稲村ヶ崎",
      lat: 35.3065, lng: 139.5173,
      triggerRadius: 200,
      scenario: "info_inamuragasaki_sas",  // シナリオD (SAS+稲村ヶ崎)
      description: "江ノ島・富士山が望める夕日スポット。サザンオールスターズの楽曲でも有名。",
    },
    {
      id: "double_doors",
      name: "Double Doors",
      lat: 35.3055, lng: 139.5120,
      triggerRadius: 150,
      scenario: "date_assist_double_doors",  // シナリオC (デートアシスト)
      description: "七里ヶ浜の海望テラスが有名なお店。5月の夕焼け（18:00〜）のデートスポット。",
    },
  ],
};
