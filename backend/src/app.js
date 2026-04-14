const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const authRoutes    = require("./routes/auth.routes");
const shopRoutes    = require("./routes/shop.routes");
const adminRoutes   = require("./routes/admin.routes");
const paymentRoutes = require("./routes/payment.routes");
const chatRoutes    = require("./routes/chat.routes");
const chatbotRoutes = require("./routes/chatbot.routes");
const importRoutes  = require("./routes/import.routes");

const app = express();

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-webhook-secret"],
}));

// ─── Rate limiting ───────────────────────────────────────────────────────────
app.use("/api/auth/login", rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Quá nhiều lần thử đăng nhập, vui lòng thử lại sau 15 phút" },
}));

app.use("/api/auth/register", rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { message: "Quá nhiều tài khoản đăng ký, vui lòng thử lại sau" },
}));

app.use("/api/", rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { message: "Quá nhiều request, vui lòng thử lại sau" },
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ─── Static files ─────────────────────────────────────────────────────────────
app.use("/uploads", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(process.cwd(), "uploads")));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, timestamp: new Date().toISOString(), env: process.env.NODE_ENV })
);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth",    authRoutes);
app.use("/api",         shopRoutes);
app.use("/api/admin",   adminRoutes);
app.use("/api/admin",   importRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/chat",    chatRoutes);
app.use("/api/chatbot", chatbotRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: "Endpoint không tồn tại" });
});

// ─── Global error handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Multer file size error
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "File quá lớn (tối đa 5MB)" });
  }
  // Multer file type error (from our fileFilter)
  if (err.message?.startsWith("File type not allowed")) {
    return res.status(400).json({ message: err.message });
  }

  const status = err.statusCode || err.status || 500;
  const message = err.isOperational ? err.message : "Lỗi máy chủ nội bộ";

  if (status >= 500) {
    console.error("[SERVER ERROR]", err);
  }

  return res.status(status).json({ message });
});

module.exports = app;