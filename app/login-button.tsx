"use client";

// Enaema マストヘッド用ログイン部品
// 未ログイン: 「ログイン」（Google へ遷移）／ ログイン中: 「ログイン中 ＋ ログアウト」
// セッション判定は auth-client.ts（localStorage）。判定が終わるまでは何も出さない。

import { useEffect, useState } from "react";
import {
getSession,
signInWithGoogle,
signOut,
type Session,
} from "./auth-client";

export default function LoginButton() {
const [session, setSession] = useState<Session | null>(null);
const [ready, setReady] = useState(false);

useEffect(() => {
let cancelled = false;
getSession()
.then((s) => {
if (cancelled) return;
setSession(s);
setReady(true);
})
.catch(() => {
if (!cancelled) setReady(true);
});
return () => {
cancelled = true;
};
}, []);

if (!ready) return null;

const onLogout = async () => {
await signOut();
window.location.reload();
};

return session? (
<span className="text-[11px]" style={{ color: "var(--muted)" }}>
ログイン中
<button
type="button"
onClick={onLogout}
className="ml-2 underline"
style={{ color: "var(--muted)" }}
>
ログアウト
</button>
</span>
): (
<button
type="button"
onClick={signInWithGoogle}
className="text-[11px] underline"
style={{ color: "var(--muted)" }}
>
ログイン
</button>
);
}
