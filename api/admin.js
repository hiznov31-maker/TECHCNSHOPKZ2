// Админка наличия. Пароль задаётся в Vercel: переменная ADMIN_PASSWORD.
import crypto from "node:crypto";
import { kvOn, getStock, setStock, getCatalog, setCatalog } from "./_kv.js";

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method" }); }
  const pass = process.env.ADMIN_PASSWORD || "";
  if (pass.length < 8) return res.status(500).json({ error: "no_password_configured" });
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  if (!crypto.timingSafeEqual(sha(b.password || ""), sha(pass))) { await sleep(700); return res.status(401).json({ error: "bad_password" }); }
  if (!kvOn()) {
    if (b.action === "set") return res.status(503).json({ error: "storage_not_connected" });
    return res.status(200).json({ kv: false, stock: {} });
  }
  try {
    if (b.action === "catalog_get") return res.status(200).json({ kv: true, catalog: await getCatalog() });
    if (b.action === "catalog_save") {
      const c = b.catalog || {};
      const json = JSON.stringify(c);
      if (json.length > 850000) return res.status(400).json({ error: "catalog_too_large" });
      // Проверяем только форму данных; текст и фото очищаются клиентом и ограничиваются ниже.
      if (!c || typeof c !== "object" || !Array.isArray(c.custom) || typeof c.prices !== "object" || typeof c.discounts !== "object") return res.status(400).json({ error: "bad_catalog" });
      if (c.custom.length > 60) return res.status(400).json({ error: "too_many_products" });
      c.custom = c.custom.map((x) => ({
        id: String(x.id || "").replace(/[^a-z0-9-]/g, "").slice(0, 30),
        brand: String(x.brand || "Другой").replace(/[<>]/g, "").slice(0, 40),
        name: String(x.name || "Новый смартфон").replace(/[<>]/g, "").slice(0, 80),
        specs: String(x.specs || "").replace(/[<>]/g, "").slice(0, 240),
        photo: String(x.photo || "").slice(0, 700000),
        variants: Array.isArray(x.variants) ? x.variants.slice(0, 20).map((v) => ({ mem: String(v.mem || "").slice(0, 20), price: Math.max(0, Math.round(Number(v.price) || 0)) })).filter((v) => v.mem && v.price) : []
      })).filter((x) => x.id && x.variants.length);
      await setCatalog(c);
      return res.status(200).json({ kv: true, catalog: c });
    }
    if (b.action === "set") {
      const id = String(b.id || "");
      if (!/^[a-z0-9]{2,20}$/.test(id)) return res.status(400).json({ error: "bad_id" });
      if (!["in", "order", "out"].includes(b.s)) return res.status(400).json({ error: "bad_status" });
      const stock = await getStock();
      stock[id] = { s: b.s, note: String(b.note == null ? "" : b.note).replace(/[\u0000-\u001F<>]/g, "").trim().slice(0, 140) };
      await setStock(stock);
      return res.status(200).json({ kv: true, stock });
    }
    return res.status(200).json({ kv: true, stock: await getStock() });
  } catch (e) {
    console.error("admin failed:", e && e.message);
    return res.status(502).json({ error: "storage_error" });
  }
}
