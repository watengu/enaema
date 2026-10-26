// Enaema 帯（ticker_items）取り込み API（v15.12 / v3: 書き込みは DB 関数経由）
// 定期ジョブが集めたトレンド行・GC記事行を、旧ローテーション行の無効化と
// 新規行の insert で差し替えるための受け口。書けるのは ticker_items の
// kind が 'buzz' / 'gc' の行だけ。
// 認証と書き込みは Supabase の関数 rotate_ticker_ingest が担う:
// ヘッダ x-ingest-secret を、app_config テーブル（key = 'ticker_ingest_secret'、
// RLS で anon/authenticated からは読めない）の値と関数の中で照合し、
// 合ったときだけローテーションを実行する。このルート自体は
// 公開キー（anon）で関数を呼ぶだけで、特権キーは使わない。

type IngestItem = {
  text: string;
  kind: "buzz" | "gc";
  url: string | null;
};

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function validateItems(raw: unknown): IngestItem[] | null {
  if (raw === null || typeof raw !== "object") return null;
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 8) return null;
  const out: IngestItem[] = [];
  for (const entry of items) {
    if (entry === null || typeof entry !== "object") return null;
    const { text, kind, url } = entry as {
      text?: unknown;
      kind?: unknown;
      url?: unknown;
    };
    if (typeof text !== "string" || text.trim().length === 0) return null;
    if (text.length > 120) return null;
    let k: "buzz" | "gc" = "buzz";
    if (kind !== undefined) {
      if (kind !== "buzz" && kind !== "gc") return null;
      k = kind;
    }
    let u: string | null = null;
    if (url !== undefined && url !== null) {
      if (typeof url !== "string" || !url.startsWith("https://")) return null;
      u = url;
    }
    out.push({ text, kind: k, url: u });
  }
  return out;
}

export async function POST(request: Request): Promise<Response> {
  // 合言葉ヘッダが無いものは常に 401 で閉じる
  const given = request.headers.get("x-ingest-secret");
  if (!given) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return json({ ok: false, error: "config" }, 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const items = validateItems(body);
  if (!items) {
    return json({ ok: false, error: "invalid_items" }, 400);
  }

  // 合言葉の照合と書き込みは DB 関数の中で行う（-1 = 合言葉不一致）
  const rpcRes = await fetch(
    supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/rotate_ticker_ingest",
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: "Bearer " + anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_secret: given, p_items: items }),
    }
  );
  if (!rpcRes.ok) {
    return json({ ok: false, error: "rpc_failed", status: rpcRes.status }, 502);
  }
  const result = (await rpcRes.json()) as unknown;
  if (result === -1) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (typeof result !== "number" || result < 0) {
    return json({ ok: false, error: "invalid_items" }, 400);
  }
  return json({ ok: true, inserted: result }, 200);
}
