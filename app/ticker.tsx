"use client";

// Enaema Bot テキストロール（細い帯）: フェードで1行ずつ切り替える
// - 文言の並び: 端末内のアドバイス（v15.7）→ 天気行 → editorial（DB の ticker_items）
// - v15.11: 天気行は、端末内に地域連動の天気行（enaema.wxlines.v1）があればそちらを優先し、
//   なければサーバーから渡された天気行（銀座）を使う
// - v15.11: 開閉で帯の高さが変わらないよう、閉じた状態でも行の箱を同じ寸法で残す
//   （中身だけ見えなくする）。表紙が開閉で上下に動かないための措置
// - v15.12: 行に url がある場合はタップでその記事へ飛べるリンクとして表示する
//   （Girls Concierge の記事などを帯から読めるようにするため）

type TickerItem = { text: string; url?: string | null };

import { useEffect, useState } from "react";

const TICKER_KEY = "enaema.ticker.v1";
const ADVICE_KEY = "enaema.advice.v1";
const WX_KEY = "enaema.wxlines.v1";

function todayJST(): string {
const parts = new Intl.DateTimeFormat("en-US", {
timeZone: "Asia/Tokyo",
year: "numeric",
month: "2-digit",
day: "2-digit",
}).formatToParts(new Date());
const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function Ticker({
items,
weatherLines,
}: {
items: TickerItem[];
weatherLines?: string[];
}) {
const [enabled, setEnabled] = useState(true);

useEffect(() => {
try {
if (window.localStorage.getItem(TICKER_KEY) === "off") setEnabled(false);
} catch {
// 読めなければオンのまま
}
}, []);

const toggle = (next: boolean) => {
setEnabled(next);
try {
window.localStorage.setItem(TICKER_KEY, next ? "on" : "off");
} catch {
// 保存できなくても表示は切り替える
}
};

const [idx, setIdx] = useState(0);

// 端末内のアドバイスと地域連動の天気行を読む（マウント時＋切替のたび）
const [advice, setAdvice] = useState<string[]>([]);
const [wx, setWx] = useState<string[]>([]);
const readLocal = () => {
try {
const raw = window.localStorage.getItem(ADVICE_KEY);
const parsed: unknown = raw ? JSON.parse(raw) : [];
if (Array.isArray(parsed)) {
const next = parsed.filter((x): x is string => typeof x === "string");
setAdvice((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
}
} catch {
// 読めなければアドバイスなしで流す
}
try {
const raw = window.localStorage.getItem(WX_KEY);
const parsed: unknown = raw ? JSON.parse(raw) : null;
if (
parsed !== null &&
typeof parsed === "object" &&
(parsed as { d?: unknown }).d === todayJST() &&
Array.isArray((parsed as { lines?: unknown }).lines)
) {
const next = (parsed as { lines: unknown[] }).lines.filter(
(x): x is string => typeof x === "string"
);
setWx((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
} else {
setWx((prev) => (prev.length === 0 ? prev : []));
}
} catch {
// 読めなければサーバーの天気行で流す
}
};

useEffect(() => {
readLocal();
}, []);

const effectiveWeather = wx.length > 0 ? wx : (weatherLines ?? []);
const allItems: TickerItem[] = [
...advice.map((text) => ({ text })),
...effectiveWeather.map((text) => ({ text })),
...items,
];

useEffect(() => {
if (!enabled || allItems.length <= 1) return;
const timer = window.setInterval(() => {
readLocal();
setIdx((v) => (v + 1) % allItems.length);
}, 4500);
return () => window.clearInterval(timer);
}, [enabled, allItems.length]);

if (allItems.length === 0) return null;

const current = allItems[idx % allItems.length];

return (
<div>
<style>{`@keyframes enaema-fade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }`}</style>
<div
className="overflow-hidden border-y py-1.5"
style={{ borderColor: "var(--line)" }}
>
{enabled ? (
<p
key={idx}
className="truncate text-[11px]"
style={{ color: "var(--muted)", animation: "enaema-fade 0.5s ease" }}
>
{current.url ? (
<a
href={current.url}
target="_blank"
rel="noreferrer"
className="underline decoration-dotted underline-offset-2"
style={{ color: "var(--muted)" }}
>
{current.text} ↗
</a>
) : (
current.text
)}
</p>
) : (
<p className="truncate text-[11px]" style={{ visibility: "hidden" }} aria-hidden="true">
{" "}
</p>
)}
</div>
<div className="mt-1 text-right">
<button
type="button"
onClick={() => toggle(!enabled)}
className="text-[10px]"
style={{ color: "var(--muted)" }}
>
{enabled ? "ひとことを閉じる" : "ひとことを開く"}
</button>
</div>
</div>
);
}
