import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  async function test(label: string, headers: Record<string, string>) {
    try {
      const res = await fetch(
        `${url}/rest/v1/situations?select=situation_id&limit=1`,
        { headers, cache: "no-store" }
      );
      const body = await res.text();
      return { label, status: res.status, body: body.slice(0, 200) };
    } catch (e) {
      return { label, status: 0, body: String(e).slice(0, 200) };
    }
  }

  const tests = [];
  if (url && key) {
    tests.push(await test("apikey-only", { apikey: key }));
    tests.push(
      await test("apikey+bearer", {
        apikey: key,
        Authorization: `Bearer ${key}`,
      })
    );
  }

  return NextResponse.json({
    url_set: url.length > 0,
    url_value: url,
    key_set: key.length > 0,
    key_len: key.length,
    key_prefix: key.slice(0, 14),
    has_whitespace: /\s/.test(url + key),
    tests,
  });
}
