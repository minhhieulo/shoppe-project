const Groq = require("groq-sdk");
const { query, execute } = require("../models/common.model");
const AppError = require("../utils/AppError");

// ── Rate limiting đơn giản trong memory ──
const rateLimitMap = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 phút
  const maxRequests = 20;
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return true;
}

const SYSTEM_PROMPT = `Bạn là trợ lý AI của Shopee Clone - một sàn thương mại điện tử Việt Nam.
Nhiệm vụ của bạn là hỗ trợ khách hàng một cách thân thiện, ngắn gọn và chuyên nghiệp.

Bạn có thể giúp khách hàng về:
- Tìm kiếm và gợi ý sản phẩm (điện thoại, laptop, phụ kiện, thời trang, gia dụng, sách...)
- Chính sách đổi trả: trong 7 ngày, sản phẩm còn nguyên vẹn, có hóa đơn
- Vận chuyển: miễn phí đơn từ 150.000đ, thời gian 2-5 ngày tùy khu vực
- Thanh toán: COD, MoMo, ZaloPay, VNPay, Visa/Mastercard
- Theo dõi đơn hàng: hướng dẫn vào mục "Đơn hàng" trên trang cá nhân
- Khuyến mãi: Flash Sale mỗi ngày, voucher giảm giá, Shopee Xu
- Tài khoản: đăng ký, đăng nhập, quên mật khẩu

Quy tắc trả lời:
- Trả lời bằng tiếng Việt, thân thiện, dùng emoji phù hợp
- Ngắn gọn, tối đa 3-4 câu mỗi lần
- Nếu không biết, hướng dẫn liên hệ admin qua tính năng Chat với Shop
- QUAN TRỌNG: Nếu được cung cấp danh sách sản phẩm thực tế từ hệ thống, hãy dùng đúng thông tin đó, KHÔNG bịa thêm
- Sau mỗi câu trả lời, thêm dòng JSON ở cuối (người dùng không thấy) theo format:
  ___SUGGESTIONS___["gợi ý 1","gợi ý 2","gợi ý 3"]
  Gợi ý phải liên quan đến ngữ cảnh vừa trả lời, ngắn gọn dưới 30 ký tự`;

const INTENT_PROMPT = `Bạn là bộ phân tích intent cho chatbot thương mại điện tử.
Phân tích tin nhắn người dùng và trả về JSON (CHỈ JSON, không giải thích):

{
  "isProductSearch": true/false,
  "isOrderQuery": true/false,
  "keyword": "từ khóa sản phẩm hoặc null",
  "minPrice": số hoặc null,
  "maxPrice": số hoặc null
}

Quy tắc:
- isProductSearch = true nếu hỏi/tìm/muốn mua sản phẩm
- isOrderQuery = true nếu hỏi về đơn hàng của mình ("đơn hàng của tôi", "đơn tôi đặt", "theo dõi đơn")
- keyword: tên sản phẩm, bỏ từ thừa như "rẻ","tốt","không","ạ","nhé"
- Giá: "200k"=200000, "1 triệu"=1000000, "15 củ"=15000000, "500 nghìn"=500000
- isProductSearch=false nếu hỏi: chính sách, vận chuyển, thanh toán, tài khoản, chào hỏi`;

// ── Fallback khi AI lỗi ──
const FALLBACK_REPLIES = [
  "Xin lỗi, hệ thống đang bận! 😅 Bạn thử lại sau vài giây nhé.",
  "Tôi đang gặp chút sự cố kỹ thuật 🔧 Vui lòng thử lại nhé!",
  "Hệ thống tạm thời quá tải 😓 Bạn có thể chat trực tiếp với Shop để được hỗ trợ ngay!",
];

async function analyzeIntent(groq, message, history) {
  const recentContext = history
    .slice(-2)
    .map((m) => `${m.role === "user" ? "User" : "Bot"}: ${m.content}`)
    .join("\n");
  const contextText = recentContext
    ? `Lịch sử:\n${recentContext}\n\nTin mới: ${message}`
    : message;
  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: INTENT_PROMPT },
        { role: "user", content: contextText },
      ],
      max_tokens: 150,
      temperature: 0,
    });
    const raw = res.choices?.[0]?.message?.content || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    console.log("[CHATBOT INTENT]", parsed);
    return parsed;
  } catch {
    return { isProductSearch: false, isOrderQuery: false, keyword: null, minPrice: null, maxPrice: null };
  }
}

async function searchProductsFromDB({ keyword, minPrice, maxPrice }) {
  if (!keyword?.trim()) return [];
  try {
    const fuzzy = `%${keyword.trim().split(/\s+/).join("%")}%`;
    const conditions = ["(p.name LIKE ? OR p.description LIKE ? OR p.brand LIKE ?)", "p.stock > 0"];
    const values = [fuzzy, fuzzy, fuzzy];
    if (minPrice) { conditions.push("ROUND(p.price - p.price * p.discount / 100) >= ?"); values.push(minPrice); }
    if (maxPrice) { conditions.push("ROUND(p.price - p.price * p.discount / 100) <= ?"); values.push(maxPrice); }
    return await query(
      `SELECT p.id, p.name, p.price, p.discount,
         ROUND(p.price - p.price * p.discount / 100) AS sale_price, p.stock,
         (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) AS thumbnail
       FROM products p WHERE ${conditions.join(" AND ")}
       ORDER BY p.created_at DESC LIMIT 5`,
      values
    );
  } catch (err) {
    console.error("[CHATBOT DB ERROR]", err);
    return [];
  }
}

async function getOrdersFromDB(userId) {
  if (!userId) return [];
  try {
    return await query(
      `SELECT id, status, payment_status, total_price, created_at
       FROM orders WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 3`,
      [userId]
    );
  } catch { return []; }
}

function formatProductsForAI(products, keyword) {
  if (!products.length)
    return `[HỆ THỐNG: Không tìm thấy sản phẩm "${keyword}". Thông báo khách và gợi ý từ khóa khác]`;
  const list = products.map((p, i) => {
    const price = Number(p.sale_price || p.price).toLocaleString("vi-VN");
    const orig = Number(p.price).toLocaleString("vi-VN");
    const disc = p.discount > 0 ? ` (giảm ${p.discount}% từ ${orig}đ)` : "";
    return `${i + 1}. ${p.name} — ${price}đ${disc} | Link: /product/${p.id}`;
  }).join("\n");
  return `[HỆ THỐNG: Tìm thấy ${products.length} sản phẩm "${keyword}":\n${list}\nGợi ý cho khách kèm link]`;
}

function formatOrdersForAI(orders) {
  if (!orders.length) return `[HỆ THỐNG: Người dùng chưa có đơn hàng nào]`;
  const statusMap = { pending: "Chờ xác nhận", confirmed: "Đã xác nhận", shipping: "Đang giao", delivered: "Đã giao", cancelled: "Đã hủy" };
  const list = orders.map((o, i) => {
    const status = statusMap[o.status] || o.status;
    const price = Number(o.total_price).toLocaleString("vi-VN");
    const date = new Date(o.created_at).toLocaleDateString("vi-VN");
    return `${i + 1}. Đơn #${o.id} — ${status} — ${price}đ — ${date}`;
  }).join("\n");
  return `[HỆ THỐNG: Đơn hàng gần nhất của người dùng:\n${list}\nHãy thông báo trạng thái cho khách]`;
}

/**
 * POST /api/chatbot/ask  — Streaming SSE
 * Body: { message, history }
 */
async function ask(req, res, next) {
  const { message, history = [] } = req.body;
  if (!message?.trim()) return next(new AppError("Thiếu nội dung message", 400));

  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  if (!checkRateLimit(ip)) return next(new AppError("Bạn gửi quá nhiều tin nhắn, vui lòng chờ 1 phút", 429));

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return next(new AppError("Chatbot chưa được cấu hình", 500));

  // ── Setup SSE streaming ──
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const groq = new Groq({ apiKey });

    // ── Bước 1: Phân tích intent bằng AI ──
    const intent = await analyzeIntent(groq, message.trim(), history);
    let products = [];
    let productContext = "";

    if (intent.isProductSearch && intent.keyword) {
      products = await searchProductsFromDB(intent);
      productContext = formatProductsForAI(products, intent.keyword);
      console.log(`[CHATBOT] keyword="${intent.keyword}" → ${products.length} sp`);
    }

    if (intent.isOrderQuery && req.user?.id) {
      const orders = await getOrdersFromDB(req.user.id);
      productContext += "\n" + formatOrdersForAI(orders);
    }

    // Gửi products ngay để frontend render card sớm
    if (products.length) {
      send("products", products.map((p) => ({
        id: p.id, name: p.name,
        price: p.sale_price || p.price,
        originalPrice: p.price,
        discount: p.discount,
        thumbnail: p.thumbnail,
        link: `/product/${p.id}`,
      })));
    }

    // ── Bước 2: Stream reply từng chữ ──
    const userMessageWithContext = productContext
      ? `${message.trim()}\n\n${productContext}`
      : message.trim();

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.filter((m) => m.role && m.content).slice(-6)
        .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      { role: "user", content: userMessageWithContext },
    ];

    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 600,
      temperature: 0.7,
      stream: true, // BẬT STREAMING
    });

    let fullReply = "";
    for await (const chunk of stream) {
      const token = chunk.choices?.[0]?.delta?.content || "";
      if (token) {
        fullReply += token;
        // Tách phần suggestions ra — không stream cho user thấy
        if (!fullReply.includes("___SUGGESTIONS___")) {
          send("token", { text: token });
        }
      }
    }

    // ── Bước 3: Parse suggestions từ reply ──
    let suggestions = [];
    let cleanReply = fullReply;
    const sugMatch = fullReply.match(/___SUGGESTIONS___(\[.*?\])/s);
    if (sugMatch) {
      try {
        suggestions = JSON.parse(sugMatch[1]);
        cleanReply = fullReply.replace(/___SUGGESTIONS___\[.*?\]/s, "").trim();
      } catch { /* ignore */ }
    }

    // Gửi event done kèm suggestions
    send("done", { suggestions });
    res.end();

    // Log vào search_history nếu có keyword
    if (intent.keyword && req.user?.id) {
      execute(
        "INSERT IGNORE INTO search_history(user_id, keyword) VALUES(?,?) ON DUPLICATE KEY UPDATE keyword=keyword",
        [req.user.id, intent.keyword]
      ).catch(() => {});
    }

  } catch (err) {
    console.error("[CHATBOT GROQ ERROR]", err?.message || err);
    // Fallback khi lỗi
    const fallback = FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
    send("token", { text: fallback });
    send("done", { suggestions: ["Thử lại", "Chat với Shop", "Xem sản phẩm"] });
    res.end();
  }
}

module.exports = { ask };