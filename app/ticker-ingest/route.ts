// Enaema 帯（ticker_items）取り込み API（v15.12）
// 定期ジョブが集めたトレンド行・GC記事行を、旧ローテーション行の無効化と
// 新規行の insert で差し替えるための受け口。書けるのは ticker_items の
// kind が 'buzz' / 'gc' の行だけで、service_role キーもこのルートの中だけに閉じる。
// 認証: ヘッダ x-ingest-secret が環境変数 TICKER_INGEST_SECRET と一致すること。

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
  // 認証（設定不備より先に判定し、シークレットなしは常に 401 で閉じる）
  const expected = process.env.TICKER_INGEST_SECRET;
  const given = request.headers.get("x-ingest-secret");
  if (!expected || !given || given !== expected) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
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

  const headers: Record<string, string> = {
    apikey: serviceKey,
    Authorization: "Bearer " + serviceKey,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
  const restBase = supabaseUrl.replace(/\/$/, "") + "/rest/v1/ticker_items";

  // (1) 旧ローテーション行（buzz / gc）を無効化
  const patchRes = await fetch(restBase + "?kind=in.(buzz,gc)", {
    method: "PATCH",
    headers,
    body: JSON.stringify({ is_active: false }),
  });
  if (!patchRes.ok) {
    return json({ ok: false, error: "deactivate_failed", status: patchRes.status }, 502);
  }

  // (2) 新規行を insert
  const rows = items.map((item, i) => ({
    text: item.text,
    kind: item.kind,
    url: item.url,
    display_order: 100 + i,
    is_active: true,
  }));
  const postRes = await fetch(restBase, {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });
  if (!postRes.ok) {
    return json({ ok: false, error: "insert_failed", status: postRes.status }, 502);
  }

  return json({ ok: true, inserted: items.length }, 200);
}
