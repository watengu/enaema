// Enaema 認証クライアント（SDK なし・Supabase Auth REST 直叩き）
// 根拠: auth-prep-2026-10-24.md（依存追加ゼロ／セッションはクライアント側 localStorage）
// フロー: signInWithGoogle → Google → Supabase → /auth-callback（#フラグメントにトークン）
//        → saveSessionFromHash で保存。以後は getSession が有効期限を見て refresh する。
// 注意: トークンは localStorage 保管（プロトタイプ前提。公開拡大時は Cookie 方式へ格上げ）

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?? "";

const SESSION_KEY = "enaema.session.v1";

export type Session = {
accessToken: string;
refreshToken: string;
expiresAt: number; // epoch ms
email: string;
};

function loadRaw(): Session | null {
try {
const raw = window.localStorage.getItem(SESSION_KEY);
if (!raw) return null;
const s = JSON.parse(raw) as Session;
if (!s.accessToken ||!s.refreshToken) return null;
return s;
} catch {
return null;
}
}

function save(s: Session) {
try {
window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
} catch {
// 保存できなくても呼び出し側は続行する
}
}

export function clearSession() {
try {
window.localStorage.removeItem(SESSION_KEY);
} catch {
// 同上
}
}

async function refresh(s: Session): Promise<Session | null> {
try {
const res = await fetch(
`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
{
method: "POST",
headers: {
apikey: SUPABASE_ANON_KEY,
"Content-Type": "application/json",
},
body: JSON.stringify({ refresh_token: s.refreshToken }),
}
);
if (!res.ok) return null;
const j = await res.json();
const next: Session = {
accessToken: j.access_token,
refreshToken: j.refresh_token?? s.refreshToken,
expiresAt: Date.now() + Number(j.expires_in?? 3600) * 1000,
email: j?.user?.email?? s.email,
};
save(next);
return next;
} catch {
return null;
}
}

// 有効なセッションを返す。期限が近い／切れていれば refresh を試み、失敗したら破棄して null
export async function getSession(): Promise<Session | null> {
const s = loadRaw();
if (!s) return null;
if (s.expiresAt - Date.now() > 60_000) return s;
const r = await refresh(s);
if (!r) {
clearSession();
return null;
}
return r;
}

export function signInWithGoogle() {
const redirectTo = `${window.location.origin}/auth-callback`;
window.location.href =
`${SUPABASE_URL}/auth/v1/authorize?provider=google` +
`&redirect_to=${encodeURIComponent(redirectTo)}`;
}

export async function signOut() {
const s = loadRaw();
if (s) {
try {
await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
method: "POST",
headers: {
apikey: SUPABASE_ANON_KEY,
Authorization: `Bearer ${s.accessToken}`,
},
});
} catch {
// サーバ側ログアウトの失敗は無視する（ローカル破棄が正）
}
}
clearSession();
}

// /auth-callback 用: URL フラグメント（#access_token=...）からセッションを保存する
export async function saveSessionFromHash(): Promise<boolean> {
const hash = window.location.hash.startsWith("#")
? window.location.hash.slice(1)
: "";
const params = new URLSearchParams(hash);
const accessToken = params.get("access_token");
const refreshToken = params.get("refresh_token");
const expiresIn = Number(params.get("expires_in")?? "3600");
if (!accessToken ||!refreshToken) return false;
let email = "";
try {
const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
headers: {
apikey: SUPABASE_ANON_KEY,
Authorization: `Bearer ${accessToken}`,
},
});
if (res.ok) {
const j = await res.json();
email = j?.email?? "";
}
} catch {
// メールが取れなくてもログイン自体は成立させる
}
save({
accessToken,
refreshToken,
expiresAt: Date.now() + expiresIn * 1000,
email,
});
return true;
}
