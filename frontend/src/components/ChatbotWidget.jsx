import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import api from "../services/api";

const BOT_AVATAR = "🤖";
const API_URL = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function getImageSrc(thumbnail) {
  if (!thumbnail) return "https://placehold.co/400x400?text=No+Image";
  if (thumbnail.startsWith("http")) return thumbnail;
  return `${API_URL}${thumbnail}`;
}

function formatPrice(price) {
  return Number(price).toLocaleString("vi-VN") + "đ";
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

// ── Mini card sản phẩm trong chatbot ──
function ProductCard({ product, onAddToCart }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/products/${product.id}`)}
      className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-100 bg-white p-2 shadow-sm hover:border-orange-300 hover:shadow-md transition-all active:scale-[0.98]"
    >
      <img
        src={getImageSrc(product.thumbnail)}
        alt={product.name}
        className="h-14 w-14 rounded-lg object-cover bg-gray-100 shrink-0"
        onError={(e) => { e.target.src = "https://placehold.co/400x400?text=No+Image"; }}
      />
      <div className="flex-1 min-w-0">
        <p className="line-clamp-2 text-[11px] font-semibold text-gray-800 leading-tight">{product.name}</p>
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-[#ee4d2d]">{formatPrice(product.price)}</span>
          {product.discount > 0 && (
            <>
              <span className="text-[10px] text-gray-400 line-through">{formatPrice(product.originalPrice)}</span>
              <span className="rounded bg-orange-100 px-1 text-[9px] font-bold text-[#ee4d2d]">-{product.discount}%</span>
            </>
          )}
        </div>
      </div>
      {/* Nút thêm giỏ hàng */}
      <button
        onClick={(e) => { e.stopPropagation(); onAddToCart(product.id); }}
        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-[#ee4d2d] text-white hover:bg-orange-600 transition-colors active:scale-95"
        title="Thêm vào giỏ hàng"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </button>
    </div>
  );
}

// ── Tin nhắn ──
function Message({ msg, onAddToCart }) {
  const isMine = msg.role === "user";
  return (
    <div className={`flex gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
      {!isMine && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-sm shadow self-end">
          {BOT_AVATAR}
        </div>
      )}
      <div className={`${isMine ? "max-w-[78%]" : "w-full max-w-[85%]"}`}>
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm whitespace-pre-wrap
          ${isMine
            ? "rounded-br-sm bg-gradient-to-br from-[#ee4d2d] to-[#ff6b35] text-white"
            : "rounded-bl-sm bg-white text-gray-800 border border-gray-100"}`}
        >
          {msg.content}
          {msg.streaming && <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse rounded-sm" />}
          <p className={`mt-1 text-right text-[9px] ${isMine ? "text-orange-200" : "text-gray-400"}`}>
            {new Date(msg.time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        {/* Card sản phẩm bên dưới tin bot */}
        {!isMine && msg.products?.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {msg.products.map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Xin chào! 👋 Tôi là trợ lý AI của Shopee Clone.\nTôi có thể giúp bạn tìm sản phẩm, kiểm tra đơn hàng, giải đáp thắc mắc!",
    time: Date.now(),
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [quickReplies, setQuickReplies] = useState([
    "Tìm điện thoại rẻ", "Chính sách đổi trả?", "Phí vận chuyển?", "Đơn hàng của tôi",
  ]);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const showStore = useStore((s) => s.showToast);
  const addToCart = useStore((s) => s.addToCart);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 300); setUnread(0); }
  }, [open]);

  const handleAddToCart = useCallback(async (productId) => {
    try {
      await api.post("/cart/add", { product_id: productId, quantity: 1 });
      showStore?.({ message: "✅ Đã thêm vào giỏ hàng!" });
    } catch {
      showStore?.({ message: "❌ Vui lòng đăng nhập để thêm vào giỏ!" });
    }
  }, [showStore]);

  const send = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    const userMsg = { role: "user", content: trimmed, time: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Thêm tin nhắn bot rỗng để stream vào
    const botMsgId = Date.now() + 1;
    setMessages((prev) => [...prev, {
      id: botMsgId, role: "assistant", content: "", time: botMsgId, streaming: true, products: [],
    }]);

    try {
      const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const token = localStorage.getItem("accessToken");

      // ── Dùng fetch thay axios để nhận SSE stream ──
      const response = await fetch(`${BASE_URL}/chatbot/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!response.ok) throw new Error("Server error");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event:")) continue;
          if (!line.startsWith("data:")) continue;

          try {
            const eventLine = lines[lines.indexOf(line) - 1] || "";
            const eventType = eventLine.replace("event: ", "").trim();
            const data = JSON.parse(line.replace("data: ", ""));

            if (eventType === "token") {
              // Stream từng chữ vào tin nhắn bot
              setMessages((prev) => prev.map((m) =>
                m.id === botMsgId ? { ...m, content: m.content + data.text } : m
              ));
            } else if (eventType === "products") {
              // Nhận card sản phẩm
              setMessages((prev) => prev.map((m) =>
                m.id === botMsgId ? { ...m, products: data } : m
              ));
            } else if (eventType === "done") {
              // Xong — cập nhật suggestions + tắt streaming indicator
              setMessages((prev) => prev.map((m) =>
                m.id === botMsgId ? { ...m, streaming: false } : m
              ));
              if (data.suggestions?.length) setQuickReplies(data.suggestions);
              if (!open) setUnread((n) => n + 1);
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === botMsgId
          ? { ...m, content: "Xin lỗi, tôi đang gặp sự cố 🙏 Thử lại sau nhé!", streaming: false }
          : m
      ));
    } finally {
      setLoading(false);
    }
  };

  // Xử lý SSE đúng format (parse lại theo event type)
  // Do buffer parsing phức tạp, dùng cách đơn giản hơn bên dưới
  const sendSimple = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    const userMsg = { role: "user", content: trimmed, time: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const botMsgId = Date.now() + 1;
    setMessages((prev) => [...prev, {
      id: botMsgId, role: "assistant", content: "", time: botMsgId, streaming: true, products: [],
    }]);

    try {
      const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const token = localStorage.getItem("accessToken");

      const response = await fetch(`${BASE_URL}/chatbot/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!response.ok) throw new Error("Server error");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let rawBuffer = "";

      const processSSE = (raw) => {
        const events = raw.split("\n\n").filter(Boolean);
        for (const eventBlock of events) {
          const lines = eventBlock.split("\n");
          let eventType = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            if (eventType === "token" && data.text) {
              setMessages((prev) => prev.map((m) =>
                m.id === botMsgId ? { ...m, content: m.content + data.text } : m
              ));
            } else if (eventType === "products" && Array.isArray(data)) {
              setMessages((prev) => prev.map((m) =>
                m.id === botMsgId ? { ...m, products: data } : m
              ));
            } else if (eventType === "done") {
              setMessages((prev) => prev.map((m) =>
                m.id === botMsgId ? { ...m, streaming: false } : m
              ));
              if (data.suggestions?.length) setQuickReplies(data.suggestions);
              if (!open) setUnread((n) => n + 1);
            }
          } catch { /* ignore */ }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        rawBuffer += decoder.decode(value, { stream: true });
        // Process complete SSE blocks (split by double newline)
        const lastDouble = rawBuffer.lastIndexOf("\n\n");
        if (lastDouble !== -1) {
          processSSE(rawBuffer.slice(0, lastDouble + 2));
          rawBuffer = rawBuffer.slice(lastDouble + 2);
        }
      }
    } catch (err) {
      console.error("[CHATBOT STREAM ERROR]", err);
      setMessages((prev) => prev.map((m) =>
        m.id === botMsgId
          ? { ...m, content: "Xin lỗi, tôi đang gặp sự cố kỹ thuật 🙏 Vui lòng thử lại!", streaming: false }
          : m
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendSimple(); }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-20 right-4 z-[90] flex w-[350px] flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
            style={{ height: "540px", maxHeight: "calc(100vh - 120px)" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-[#ee4d2d] to-[#ff6b35] px-4 py-3 shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xl backdrop-blur-sm">
                {BOT_AVATAR}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Trợ lý AI Shopee</p>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
                  <span className="text-[10px] text-orange-100">Luôn sẵn sàng hỗ trợ</span>
                </div>
              </div>
              <button onClick={() => setMessages([messages[0]])}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors mr-1"
                title="Xóa lịch sử chat">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
              {messages.map((msg, i) => (
                <Message key={msg.id || i} msg={msg} onAddToCart={handleAddToCart} />
              ))}
              {loading && messages[messages.length - 1]?.content === "" && (
                <div className="flex gap-2 justify-start">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-sm">
                    {BOT_AVATAR}
                  </div>
                  <div className="rounded-2xl rounded-bl-sm bg-white border border-gray-100 shadow-sm">
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick replies động */}
            <div className="flex gap-1.5 overflow-x-auto px-4 py-2 bg-gray-50 border-t border-gray-100 scrollbar-hide shrink-0">
              {quickReplies.map((q) => (
                <button key={q} onClick={() => sendSimple(q)}
                  className="shrink-0 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-medium text-orange-600 hover:bg-orange-100 transition-colors">
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-gray-100 bg-white px-3 py-2.5 shrink-0">
              <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2">
                <input
                  ref={inputRef}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                  placeholder="Nhập câu hỏi... (Enter gửi)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={loading}
                />
                <button onClick={() => sendSimple()}
                  disabled={!input.trim() || loading}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ee4d2d] text-white transition-all hover:bg-orange-600 disabled:opacity-40 active:scale-95">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              <p className="mt-1 text-center text-[9px] text-gray-300">Powered by Groq AI ⚡</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bubble Button */}
      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#ee4d2d] to-[#ff6b35] shadow-lg shadow-orange-300/50 text-2xl">
        <AnimatePresence mode="wait">
          {open
            ? <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>✕</motion.span>
            : <motion.span key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>💬</motion.span>
          }
        </AnimatePresence>
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </motion.button>
    </>
  );
}