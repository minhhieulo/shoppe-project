const { query, execute } = require("../models/common.model");
const AppError = require("../utils/AppError");

// ─── Admin endpoints ──────────────────────────────────────────────────────────

/**
 * GET /api/chat/conversations
 * Lấy danh sách tất cả user đã từng nhắn tin, kèm tin nhắn cuối + số chưa đọc
 */
async function getConversations(_req, res) {
  const rows = await query(`
    SELECT
      u.id        AS user_id,
      u.name,
      u.email,
      u.avatar,
      MAX(m.created_at) AS last_time,
      (
        SELECT message FROM messages
        WHERE sender_id = u.id OR receiver_id = u.id
        ORDER BY created_at DESC
        LIMIT 1
      ) AS last_message,
      SUM(
        CASE WHEN m.is_read = 0 AND m.sender_id = u.id THEN 1 ELSE 0 END
      ) AS unread_count
    FROM users u
    LEFT JOIN messages m
      ON (m.sender_id = u.id OR m.receiver_id = u.id)
    WHERE u.role = 'user'
    GROUP BY u.id, u.name, u.email, u.avatar
    HAVING last_time IS NOT NULL
    ORDER BY last_time DESC
  `);
  return res.json(rows);
}

/**
 * GET /api/chat/thread/:userId
 * Lấy toàn bộ lịch sử tin nhắn giữa admin và 1 user cụ thể
 * Đồng thời đánh dấu tất cả tin nhắn từ user đó là đã đọc
 */
async function getThread(req, res, next) {
  const adminId = req.user.id;
  const userId  = Number(req.params.userId);
  if (!userId) return next(new AppError("userId không hợp lệ", 400));

  // Đánh dấu đã đọc tất cả tin nhắn user gửi cho admin
  await execute(
    "UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0",
    [userId, adminId]
  );

  const rows = await query(
    `SELECT
       m.id,
       m.sender_id,
       m.receiver_id,
       m.message,
       m.is_read,
       m.created_at,
       u.name   AS sender_name,
       u.avatar AS sender_avatar
     FROM messages m
     INNER JOIN users u ON u.id = m.sender_id
     WHERE
       (m.sender_id = ? AND m.receiver_id = ?)
       OR
       (m.sender_id = ? AND m.receiver_id = ?)
     ORDER BY m.created_at ASC`,
    [adminId, userId, userId, adminId]
  );
  return res.json(rows);
}

/**
 * POST /api/chat/send
 * Admin gửi tin nhắn đến 1 user cụ thể
 * Body: { receiver_id, message }
 */
async function adminSend(req, res, next) {
  const senderId              = req.user.id;
  const { receiver_id, message } = req.body;

  if (!receiver_id)       return next(new AppError("Thiếu receiver_id", 400));
  if (!message?.trim())   return next(new AppError("Thiếu nội dung message", 400));

  // Kiểm tra receiver tồn tại và là user
  const users = await query(
    "SELECT id FROM users WHERE id = ? AND role = 'user'",
    [Number(receiver_id)]
  );
  if (!users.length) return next(new AppError("Người nhận không tồn tại", 404));

  const result = await execute(
    "INSERT INTO messages(sender_id, receiver_id, message, is_read) VALUES(?,?,?,0)",
    [senderId, Number(receiver_id), message.trim()]
  );

  return res.status(201).json({
    message : "Đã gửi",
    id      : result.insertId,
    sender_id  : senderId,
    receiver_id: Number(receiver_id),
    content : message.trim(),
    created_at : new Date(),
  });
}

// ─── User endpoints ───────────────────────────────────────────────────────────

/**
 * POST /api/chat/user/send
 * User gửi tin nhắn lên admin
 * Body: { message }
 */
async function userSend(req, res, next) {
  const senderId      = req.user.id;
  const { message }   = req.body;

  if (!message?.trim()) return next(new AppError("Thiếu nội dung message", 400));

  // Lấy admin đầu tiên
  const admins = await query(
    "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
  );
  if (!admins.length) return next(new AppError("Không tìm thấy admin", 404));

  const result = await execute(
    "INSERT INTO messages(sender_id, receiver_id, message, is_read) VALUES(?,?,?,0)",
    [senderId, admins[0].id, message.trim()]
  );

  return res.status(201).json({
    message    : "Đã gửi",
    id         : result.insertId,
    sender_id  : senderId,
    receiver_id: admins[0].id,
    content    : message.trim(),
    created_at : new Date(),
  });
}

/**
 * GET /api/chat/user/thread
 * User lấy toàn bộ lịch sử chat của mình với admin
 */
async function userGetThread(req, res) {
  const userId = req.user.id;

  const admins = await query(
    "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
  );
  if (!admins.length) return res.json([]);
  const adminId = admins[0].id;

  const rows = await query(
    `SELECT
       m.id,
       m.sender_id,
       m.receiver_id,
       m.message,
       m.is_read,
       m.created_at,
       u.name   AS sender_name,
       u.avatar AS sender_avatar
     FROM messages m
     INNER JOIN users u ON u.id = m.sender_id
     WHERE
       (m.sender_id = ? AND m.receiver_id = ?)
       OR
       (m.sender_id = ? AND m.receiver_id = ?)
     ORDER BY m.created_at ASC`,
    [userId, adminId, adminId, userId]
  );
  return res.json(rows);
}

/**
 * GET /api/chat/user/unread-count
 * Lấy số tin nhắn chưa đọc của user (admin gửi cho user mà user chưa đọc)
 */
async function userUnreadCount(req, res) {
  const userId = req.user.id;

  const [row] = await query(
    `SELECT COUNT(*) AS unread_count
     FROM messages
     WHERE receiver_id = ? AND is_read = 0`,
    [userId]
  );
  return res.json({ unread_count: row.unread_count });
}

/**
 * POST /api/chat/user/mark-read
 * User đánh dấu đã đọc tất cả tin từ admin
 */
async function userMarkRead(req, res) {
  const userId = req.user.id;

  await execute(
    "UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND is_read = 0",
    [userId]
  );
  return res.json({ message: "Đã đánh dấu đọc" });
}

module.exports = {
  // Admin
  getConversations,
  getThread,
  adminSend,
  // User
  userSend,
  userGetThread,
  userUnreadCount,
  userMarkRead,
};