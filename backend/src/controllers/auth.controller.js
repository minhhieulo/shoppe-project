const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { query, execute } = require("../models/common.model");
const { signAccessToken, signRefreshToken } = require("../utils/token");
const AppError = require("../utils/AppError");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar || null };
}

// ─── Email / Password ─────────────────────────────────────────────────────────

async function register(req, res, next) {
  const { name, email, password } = req.body;

  const existing = await query("SELECT id FROM users WHERE email = ?", [email]);
  if (existing.length) return next(new AppError("Email đã được sử dụng", 409));

  const hashed = await bcrypt.hash(password, 12);
  await execute(
    "INSERT INTO users(name, email, password, role) VALUES(?, ?, ?, 'user')",
    [name.trim(), email.toLowerCase().trim(), hashed]
  );

  return res.status(201).json({ message: "Đăng ký thành công" });
}

async function login(req, res, next) {
  const { email, password } = req.body;

  const users = await query("SELECT * FROM users WHERE email = ?", [email.toLowerCase().trim()]);
  const user = users[0];
  if (!user) return next(new AppError("Email hoặc mật khẩu không đúng", 401));
  if (user.is_blocked) return next(new AppError("Tài khoản đã bị khóa", 403));

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return next(new AppError("Email hoặc mật khẩu không đúng", 401));

  const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await execute("DELETE FROM refresh_tokens WHERE user_id = ?", [user.id]);
  await execute(
    "INSERT INTO refresh_tokens(user_id, token, expires_at) VALUES(?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))",
    [user.id, refreshToken]
  );

  return res.json({ user: safeUser(user), accessToken, refreshToken });
}

async function refresh(req, res, next) {
  const { refreshToken } = req.body;
  if (!refreshToken) return next(new AppError("Thiếu refresh token", 401));

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return next(new AppError("Refresh token không hợp lệ hoặc đã hết hạn", 401));
  }

  const tokens = await query(
    "SELECT id FROM refresh_tokens WHERE user_id = ? AND token = ? AND expires_at > NOW()",
    [decoded.id, refreshToken]
  );
  if (!tokens.length) return next(new AppError("Refresh token đã bị thu hồi", 401));

  const payload = { id: decoded.id, email: decoded.email, role: decoded.role, name: decoded.name };
  const newAccessToken = signAccessToken(payload);
  const newRefreshToken = signRefreshToken(payload);

  await execute("DELETE FROM refresh_tokens WHERE id = ?", [tokens[0].id]);
  await execute(
    "INSERT INTO refresh_tokens(user_id, token, expires_at) VALUES(?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))",
    [decoded.id, newRefreshToken]
  );

  return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await execute("DELETE FROM refresh_tokens WHERE token = ?", [refreshToken]);
  }
  return res.json({ message: "Đăng xuất thành công" });
}

async function me(req, res, next) {
  const users = await query(
    "SELECT id, name, email, avatar, role, is_blocked, created_at FROM users WHERE id = ?",
    [req.user.id]
  );
  if (!users.length) return next(new AppError("Người dùng không tồn tại", 404));
  return res.json(users[0]);
}

async function forgotPassword(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();

  const users = await query("SELECT id FROM users WHERE email = ?", [email]);
  if (!users.length) return res.json({ message: "Nếu email tồn tại, token đặt lại đã được tạo" });

  const token = crypto.randomBytes(32).toString("hex");
  await execute("DELETE FROM password_resets WHERE user_id = ?", [users[0].id]);
  await execute(
    "INSERT INTO password_resets(user_id, token, expires_at) VALUES(?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))",
    [users[0].id, token]
  );

  // Production: await mailService.sendResetEmail(email, token);

  return res.json({ message: "Nếu email tồn tại, token đặt lại đã được tạo", resetToken: token });
}

async function resetPassword(req, res, next) {
  const { token, newPassword } = req.body;

  const rows = await query(
    "SELECT * FROM password_resets WHERE token = ? AND expires_at > NOW()",
    [token]
  );
  if (!rows.length) return next(new AppError("Token không hợp lệ hoặc đã hết hạn", 400));

  const hashed = await bcrypt.hash(newPassword, 12);
  await execute("UPDATE users SET password = ? WHERE id = ?", [hashed, rows[0].user_id]);
  await execute("DELETE FROM password_resets WHERE id = ?", [rows[0].id]);
  await execute("DELETE FROM refresh_tokens WHERE user_id = ?", [rows[0].user_id]);

  return res.json({ message: "Đặt lại mật khẩu thành công" });
}

// ─── SĐT + OTP ────────────────────────────────────────────────────────────────

async function sendOTP(req, res, next) {
  const phone = String(req.body.phone || "").trim();
  if (!phone) return next(new AppError("Thiếu số điện thoại", 400));

  const code = String(Math.floor(100000 + Math.random() * 900000));

  await execute("DELETE FROM otp_codes WHERE phone = ?", [phone]);
  await execute(
    "INSERT INTO otp_codes(phone, code, expires_at) VALUES(?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))",
    [phone, code]
  );

  // ── Uncomment khi có Twilio key thật ──
  // const twilio = require("twilio")(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  // await twilio.messages.create({
  //   body: `Mã OTP của bạn là: ${code}. Có hiệu lực trong 5 phút.`,
  //   from: process.env.TWILIO_PHONE,
  //   to: `+84${phone.replace(/^0/, "")}`,
  // });

  const isDev = process.env.NODE_ENV !== "production";
  return res.json({
    message: "Đã gửi OTP",
    ...(isDev && { otp: code }), // Xóa dòng này trên production!
  });
}

async function verifyOTP(req, res, next) {
  const phone = String(req.body.phone || "").trim();
  const code  = String(req.body.code  || "").trim();
  if (!phone || !code) return next(new AppError("Thiếu phone hoặc code", 400));

  const rows = await query(
    "SELECT * FROM otp_codes WHERE phone = ? AND code = ? AND expires_at > NOW() AND used = 0",
    [phone, code]
  );
  if (!rows.length) return next(new AppError("OTP không hợp lệ hoặc đã hết hạn", 400));

  await execute("UPDATE otp_codes SET used = 1 WHERE id = ?", [rows[0].id]);

  let users = await query("SELECT * FROM users WHERE phone = ?", [phone]);
  if (!users.length) {
    const result = await execute(
      "INSERT INTO users(name, phone, auth_provider, role) VALUES(?, ?, 'phone', 'user')",
      [`User ${phone.slice(-4)}`, phone]
    );
    users = await query("SELECT * FROM users WHERE id = ?", [result.insertId]);
  }

  const user = users[0];
  if (user.is_blocked) return next(new AppError("Tài khoản đã bị khóa", 403));

  const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await execute("DELETE FROM refresh_tokens WHERE user_id = ?", [user.id]);
  await execute(
    "INSERT INTO refresh_tokens(user_id, token, expires_at) VALUES(?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))",
    [user.id, refreshToken]
  );

  return res.json({ user: safeUser(user), accessToken, refreshToken });
}

// ─── Google / Facebook OAuth callback ────────────────────────────────────────
// Được gọi sau khi passport.js xác thực xong → redirect về frontend kèm token

async function oauthCallback(req, res, next) {
  try {
    const user = req.user;
    if (!user) return next(new AppError("Xác thực OAuth thất bại", 401));

    const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
    const accessToken  = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await execute("DELETE FROM refresh_tokens WHERE user_id = ?", [user.id]);
    await execute(
      "INSERT INTO refresh_tokens(user_id, token, expires_at) VALUES(?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))",
      [user.id, refreshToken]
    );

    const redirectUrl = new URL(`${process.env.CLIENT_URL}/oauth-callback`);
    redirectUrl.searchParams.set("accessToken", accessToken);
    redirectUrl.searchParams.set("refreshToken", refreshToken);

    return res.redirect(redirectUrl.toString());
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register, login, refresh, logout, me, forgotPassword, resetPassword,
  sendOTP, verifyOTP, oauthCallback,
};