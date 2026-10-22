// Публичная, намеренно ограниченная выдача каталога: секретов здесь нет.
import { kvOn, getCatalog } from "./_kv.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method" }); }
  if (!kvOn()) return res.status(200).json({ prices: {}, discounts: {}, custom: [] });
  try { return res.status(200).json(await getCatalog()); }
  catch (e) { return res.status(200).json({ prices: {}, discounts: {}, custom: [] }); }
}
