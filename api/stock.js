// Наличие моделей из Google Таблицы (опубликованной как CSV).
// Ссылка задаётся в Vercel: переменная STOCK_CSV_URL. Правите таблицу, сайт обновляется сам (до минуты).
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function status(v) {
  const t = String(v || "").toLowerCase();
  if (/нет|не в налич|прод|законч|снят/.test(t)) return "out";
  if (t.includes("налич")) return "in";
  return "order";
}
import { kvOn, getStock } from "./_kv.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
  if (kvOn()) {
    try {
      const st = await getStock(); const out = {};
      Object.keys(st).forEach((id) => { if (/^[a-z0-9]{2,20}$/.test(id) && st[id]) out[id] = { s: ["in", "order", "out"].includes(st[id].s) ? st[id].s : "order", note: String(st[id].note || "").slice(0, 140) }; });
      return res.status(200).json(out);
    } catch (e) { return res.status(200).json({}); }
  }
  const url = (process.env.STOCK_CSV_URL || "").trim();
  if (!/^https:\/\/docs\.google\.com\//.test(url)) return res.status(200).json({});
  try {
    const r = await fetch(url, { redirect: "follow" });
    if (!r.ok) return res.status(200).json({});
    const rows = parseCsv(await r.text());
    const out = {};
    rows.slice(1).forEach((c) => {
      const id = String(c[0] || "").trim();
      if (!/^[a-z0-9]{2,20}$/.test(id)) return;
      out[id] = { s: status(c[2]), note: String(c[3] || "").trim().slice(0, 140) };
    });
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json({});
  }
}
