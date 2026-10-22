// Хранилище наличия: Upstash Redis (подключается в Vercel → Storage). Работает через REST, без npm-пакетов.
const cfg = () => ({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});
export const kvOn = () => { const c = cfg(); return !!(c.url && c.token); };
async function cmd(args) {
  const c = cfg();
  const r = await fetch(c.url, { method: "POST", headers: { Authorization: "Bearer " + c.token, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
export async function getStock() {
  const v = await cmd(["GET", "stock"]);
  if (!v) return {};
  try { const o = JSON.parse(v); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; }
}
export async function setStock(o) { await cmd(["SET", "stock", JSON.stringify(o)]); }

// Каталог, цены и акции редактируются из защищённой админки.
export async function getCatalog() {
  const v = await cmd(["GET", "catalog"]);
  if (!v) return { prices: {}, discounts: {}, custom: [] };
  try {
    const o = JSON.parse(v);
    return o && typeof o === "object" ? {
      prices: o.prices && typeof o.prices === "object" ? o.prices : {},
      discounts: o.discounts && typeof o.discounts === "object" ? o.discounts : {},
      custom: Array.isArray(o.custom) ? o.custom : []
    } : { prices: {}, discounts: {}, custom: [] };
  } catch (e) { return { prices: {}, discounts: {}, custom: [] }; }
}
export async function setCatalog(o) { await cmd(["SET", "catalog", JSON.stringify(o)]); }
