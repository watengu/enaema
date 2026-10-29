// 天気の共通部品（v15.8）: 地域定義と、Open-Meteo のコード→表示文への変換、取得処理。
// サーバー（page.tsx の銀座・既定表示）とクライアント（home-client.tsx の地域切り替え）で共有する。

export type WeatherData = {
label: string;
max: number;
min: number;
now: number | null;
condition: string;
conditionShort: string;
icon: string;
uvMax: number | null;
humidityDay: number | null;
tomorrow: { label: string; max: number; min: number } | null;
};

// ピンポイントのファッション地域（Ao 指定 2026-10-26、8ヶ所）
export const REGIONS = [
{ id: "ginza", name: "銀座", en: "GINZA", lat: 35.6712, lon: 139.7649 },
{ id: "shinjuku", name: "新宿", en: "SHINJUKU", lat: 35.6938, lon: 139.7034 },
{ id: "shibuya", name: "渋谷", en: "SHIBUYA", lat: 35.6595, lon: 139.7005 },
{ id: "osu", name: "大須", en: "OSU", lat: 35.1597, lon: 136.9042 },
{ id: "umeda", name: "梅田", en: "UMEDA", lat: 34.7024, lon: 135.4952 },
{ id: "shinsaibashi", name: "心斎橋", en: "SHINSAIBASHI", lat: 34.6751, lon: 135.5008 },
{ id: "tenjin", name: "天神", en: "TENJIN", lat: 33.5897, lon: 130.3988 },
{ id: "odori", name: "大通", en: "ODORI", lat: 43.0604, lon: 141.3496 },
] as const;

export function weatherLabel(code: number): string {
if (code === 0 || code === 1) return "晴れ";
if (code === 2) return "晴れ時々曇り";
if (code === 3) return "曇り";
if (code === 45 || code === 48) return "霧";
if (code >= 51 && code <= 57) return "霧雨";
if (code === 61 || code === 63 || code === 66 || code === 67) return "雨";
if (code === 65 || code === 82) return "大雨";
if (code === 71 || code === 73 || code === 77) return "雪";
if (code === 75 || code === 85 || code === 86) return "大雪";
if (code === 80 || code === 81) return "にわか雨";
if (code >= 95) return "雷雨";
return "―";
}

export function conditionLine(code: number, max: number): string {
if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95)
return "雨対策と湿気ケアを忘れずに";
if (code >= 71 && code <= 86) return "足元と防寒に気をつけて";
if (max >= 28) return "暑さと紫外線の対策を";
if (max >= 23) return "軽やかな装いで過ごしやすい一日";
if (max >= 17) return "羽織りものがあると安心な一日";
if (max >= 11) return "暖かめのコーデが安心な一日";
return "しっかり防寒したい一日";
}

// 表紙用の短い一言（ボックスに収まる長さ）
export function weatherConditionShort(code: number, max: number): string {
if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95)
return "雨対策・湿気ケアを";
if (code >= 71 && code <= 86) return "足元と防寒に";
if (max >= 28) return "暑さ・紫外線対策を";
if (max >= 23) return "軽やかな装いで";
if (max >= 17) return "羽織りものが安心";
if (max >= 11) return "暖かめコーデで";
return "しっかり防寒を";
}

// 天気アイコンの種類（表紙ボックス用）
export function weatherIconName(code: number): string {
if (code === 0 || code === 1) return "sun";
if (code === 2 || code === 3 || code === 45 || code === 48) return "cloud";
if (code >= 71 && code <= 86) return "snow";
if (code >= 95) return "storm";
return "rain";
}

// Open-Meteo（無料・キー不要）。失敗時は null（天気ボックスを出さない）
export async function fetchWeatherAt(
lat: number,
lon: number,
init?: object,
): Promise<WeatherData | null> {
try {
const url =
"https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
"&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max" +
"&hourly=relative_humidity_2m" +
"&current=temperature_2m&timezone=Asia%2FTokyo&forecast_days=2";
const res = await fetch(url, init as RequestInit | undefined);
if (!res.ok) return null;
const j = await res.json();
const code = Number(j?.daily?.weather_code?.[0]);
const max = Math.round(Number(j?.daily?.temperature_2m_max?.[0]));
const min = Math.round(Number(j?.daily?.temperature_2m_min?.[0]));
if (Number.isNaN(code) || Number.isNaN(max) || Number.isNaN(min))
return null;
const nowRaw = Number(j?.current?.temperature_2m);
const tCode = Number(j?.daily?.weather_code?.[1]);
const tMax = Math.round(Number(j?.daily?.temperature_2m_max?.[1]));
const tMin = Math.round(Number(j?.daily?.temperature_2m_min?.[1]));
const tomorrow =
Number.isNaN(tCode) || Number.isNaN(tMax) || Number.isNaN(tMin)
? null
: { label: weatherLabel(tCode), max: tMax, min: tMin };
// UV（当日最大）と日中（9–18時）の平均湿度。取れない場合は null（判定側は従来式にフォールバック）
const uvRaw = Number(j?.daily?.uv_index_max?.[0]);
const uvMax = Number.isNaN(uvRaw) ? null : Math.round(uvRaw * 10) / 10;
let humidityDay: number | null = null;
const hTimes: unknown[] = Array.isArray(j?.hourly?.time) ? j.hourly.time : [];
const hVals: unknown[] = Array.isArray(j?.hourly?.relative_humidity_2m)
? j.hourly.relative_humidity_2m
: [];
if (hTimes.length > 0 && hTimes.length === hVals.length) {
const todayStr = String(hTimes[0]).slice(0, 10);
const picks: number[] = [];
for (let i = 0; i < hTimes.length; i++) {
const t = String(hTimes[i]);
if (!t.startsWith(todayStr)) continue;
const hour = Number(t.slice(11, 13));
const v = Number(hVals[i]);
if (hour >= 9 && hour < 18 && !Number.isNaN(v)) picks.push(v);
}
if (picks.length >= 3)
humidityDay = Math.round(picks.reduce((a, b) => a + b, 0) / picks.length);
}
return {
label: weatherLabel(code),
max,
min,
now: Number.isNaN(nowRaw) ? null : Math.round(nowRaw),
condition: conditionLine(code, max),
conditionShort: weatherConditionShort(code, max),
icon: weatherIconName(code),
uvMax,
humidityDay,
tomorrow,
};
} catch {
return null;
}
}
