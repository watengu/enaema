"use client";

// Enaema Bot テキストロール（細い帯）v14.2: 横スクロールをやめ、フェードで1行ずつ切り替える
// - ファッションの小ネタ・予告・天気などを、表紙の外（ホーム下部）で静かに流す
// - 細く・遅く・薄く。オンオフ可能（設定は端末内に保存、既定はオン）
// - 文言はサーバ側で用意した lines をそのまま流す（天気＝実データ、 editorial＝DB の ticker_items）

import { useEffect, useState } from "react";

const TICKER_KEY = "enaema.ticker.v1";

export default function Ticker({ lines }: { lines: string[] }) {
const [enabled, setEnabled] = useState(true);
const [ready, setReady] = useState(false);

useEffect(() => {
try {
if (window.localStorage.getItem(TICKER_KEY) === "off") setEnabled(false);
} catch {
// 読めなければオンのまま
}
setReady(true);
}, []);

const toggle = (next: boolean) => {
setEnabled(next);
try {
window.localStorage.setItem(TICKER_KEY, next? "on": "off");
} catch {
// 保存できなくても表示は切り替える
}
};

const [idx, setIdx] = useState(0);

// v15.7: 端末内のアドバイス（ステータスとセットの不一致など）を先頭に混ぜて流す
const [advice, setAdvice] = useState<string[]>([]);
const readAdvice = () => {
try {
const raw = window.localStorage.getItem("enaema.advice.v1");
const parsed: unknown = raw? JSON.parse(raw): [];
if (Array.isArray(parsed)) {
const next = parsed.filter((x): x is string => typeof x === "string");
setAdvice((prev) => (JSON.stringify(prev) === JSON.stringify(next)? prev: next));
}
} catch {
// 読めなければアドバイスなしで流す
}
};

useEffect(() => {
readAdvice();
}, []);

const allLines = [...advice, ...lines];

useEffect(() => {
if (!enabled || allLines.length <= 1) return;
const timer = window.setInterval(() => {
readAdvice();
setIdx((v) => (v + 1) % allLines.length);
}, 4500);
return () => window.clearInterval(timer);
}, [enabled, allLines.length]);

if (!ready || allLines.length === 0) return null;

if (!enabled) {
return (
<div className="text-right">
<button
type="button"
onClick={() => toggle(true)}
className="text-[10px]"
style={{ color: "var(--muted)"}}
>
ひとことを出す
</button>
</div>
);
}

return (
<div>
<style>{`@keyframes enaema-fade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }`}</style>
<div
className="overflow-hidden border-y py-1.5"
style={{ borderColor: "var(--line)"}}
>
<p
key={idx}
className="truncate text-[11px]"
style={{ color: "var(--muted)", animation: "enaema-fade 0.5s ease" }}
>
{allLines[idx % allLines.length]}
</p>
</div>
<div className="mt-1 text-right">
<button
type="button"
onClick={() => toggle(false)}
className="text-[10px]"
style={{ color: "var(--muted)"}}
>
ひとことを隠す
</button>
</div>
</div>
);
}
