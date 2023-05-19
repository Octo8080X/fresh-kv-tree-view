export const row_kv = await Deno.openKv(Deno.env.get("KV_PATH") || undefined);
