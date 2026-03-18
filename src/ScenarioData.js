/**
 * Directions APIによる経路計算用の地点データ
 */
export const ROUTE_ORIGIN = { lat: 35.319343, lng: 139.551068 }; // 鎌倉駅東口バスターミナルではなく、駅前の大通り（県道21号）の交差点付近
export const ROUTE_DESTINATION = { lat: 35.305608, lng: 139.510006 }; // 七里ヶ浜海岸駐車場 鎌倉側

// Waypointsを指定するとDirections APIが駐車場や側道でUターンする現象を招きやすいため、
// 今回は「鎌倉駅から七里ヶ浜への最短・最速ルート」をAPIの自然な探索に委ねます。
// (通常は134号線つまり海沿いルートが選択されます)
export const ROUTE_WAYPOINTS = [];

/**
 * 経路上で点滅表示させるランドマーク定義
 */
export const LANDMARKS = [
  {
    id: "tsurugaoka",
    name: "鶴岡八幡宮",
    position: { lat: 35.3260, lng: 139.5560 },
    iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
  },
  {
    id: "goodmellows",
    name: "Good Mellows",
    position: { lat: 35.3100, lng: 139.5410 },
    iconUrl: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
  },
  {
    id: "doubledoors",
    name: "Double Doors",
    position: { lat: 35.3065, lng: 139.5105 },
    iconUrl: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png"
  }
];

export const ROUTE_CONTEXT = [
  "鎌倉駅を出発したところ。北に鶴岡八幡宮がある。これから海に向かって参道（若宮大路）を南下する。",
  "若宮大路を南下中。鶴岡八幡宮を背にして海に向かっている。",
  "もうすぐ滑川交差点。海にぶつかる手前。",
  "滑川交差点。ここで『右折』して134号線に入る。西が由比ヶ浜、東が材木座海岸（どちらも遠浅で有名な海水浴場）。",
  "由比ヶ浜沿いを西に走行中。右手に有名なハンバーガー店『Good Mellows』が見える。",
  "由比ヶ浜から稲村ヶ崎に向かって走行中。",
  "稲村ヶ崎付近を走行中。ここからは江ノ島と富士山が見え、夕日が極めて綺麗。サザンの曲が似合うシチュエーション。",
  "目的地の七里ヶ浜海岸（日本の渚100選、サーフィンメッカ、おしゃれなカフェが並ぶデートスポット）。すぐ近くに夕食を食べる『ダブルドアーズ・七里ガ浜本店』がある。"
];

export const SYSTEM_PROMPT = `
あなたはVoiceNaviというAIドライビングパートナーです。
現在、クルマは自動運転で鎌倉駅から目的地の「ダブルドアーズ・七里ガ浜本店」（七里ヶ浜駐車場付近）へ向かっています。
ドライバーは30代男性の「ショウヘイ」でサザンオールスターズのファンです。助手席にはパートナーの20代女性「マミコ」が乗っており、ドライブデートをして夕日と夕食を楽しむ計画です。現在は夕方の17:50頃で、夕焼けが綺麗です。

ユーザー（ドライバー）の発話を受け取り、以下のJSON形式でのみ出力してください。
{
  "reply_text": "読み上げるテキスト",
  "action": "none | play_music | circulation_mode | show_info",
  "target_landmark_id": "none | tsurugaoka | goodmellows | doubledoors"
}

システム制約と振る舞い:
- 【重要】ユーザーの意図を汲み取り、用意されたシナリオ以外の話題（「こんにちは」「お腹すいた」等）に対しても柔軟かつ自然で人間らしい返答をしてください。
- 出力は必ずJSONの構造のみとしてください（JSONを囲むMarkdownの記号などは含めないでください）。
- 車は自動運転です。コンテキスト情報から『右折』等のイベントがあれば、乗員を不安にさせないよう「右に曲がるよ」等と発話のついでに自然に伝えてください。
- メンタルマップ（周囲の地理情報、由比ヶ浜、江ノ島、富士山、夕日など）を適度に会話に織り交ぜてドライブを盛り上げてください。
- 稲村ヶ崎や江ノ島の話題、またはユーザーがサザンの曲を求めた場合は、actionに "play_music" を入れてください。
- 目標ランドマークについて話す場合は target_landmark_id を設定してください。
- 危険な要求は丁寧に回避してください。
`;
