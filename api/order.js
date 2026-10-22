// Vercel Serverless Function: принимает заявку и отправляет её в Telegram.
// Токен и chat id берутся ТОЛЬКО из переменных окружения Vercel (TG_BOT_TOKEN, TG_CHAT_ID).
const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, n);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const token = (process.env.TG_BOT_TOKEN || "").trim();
  const chatId = (process.env.TG_CHAT_ID || "").trim();
  if (!token || !chatId) return res.status(500).json({ error: "Server is not configured" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  if (body.hp) return res.status(200).json({ success: true }); // ловушка для ботов
  if (typeof body.t === "number" && body.t < 1500) return res.status(200).json({ success: true }); // слишком быстро для человека

  const name = clip(body.name, 60).trim();
  const contact = clip(body.contact, 80).trim();
  if (!name) return res.status(400).json({ error: "name_required" });
  if (contact.length < 5) return res.status(400).json({ error: "contact_required" });

  const text = [
    "🛍️ НОВЫЙ ЗАКАЗ С САЙТА!",
    "",
    "Заказ: " + (clip(body.orderNo, 30) || "—"),
    "Товар: " + (clip(body.item, 300) || "—"),
    "Сумма: " + (clip(body.total, 40) || "—"),
    "Имя: " + name,
    "Контакты: " + contact,
    ...(body.text ? ["", "Текст заказа:", clip(body.text, 900)] : []),
  ].join("\n");

  try {
    const r = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    const data = await r.json().catch(() => ({}));
    if (!data.ok) {
      console.error("Telegram rejected:", data.error_code, data.description);
      return res.status(502).json({ error: "telegram_error" });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("order failed:", err && err.message);
    return res.status(502).json({ error: "network_error" });
  }
}
