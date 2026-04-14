const { query, execute } = require("../models/common.model");
const AppError = require("../utils/AppError");

// ─── Admin endpoints ──────────────────────────────────────────────────────────

/**
 * GET /api/chat/conversations
 * Lấy danh sách tất cả user đã từng nhắn tin, kèm tin nhắn cuối + số chưa đọc
 *
 * FIX: Dùng UNION thay OR trong JOIN để tránh MySQL duplicate rows bug
 */
async function getConversations(_req, res) {
  const rows = await query(`
    SELECT
      u.id    AS user_id,
      u.name,
      u.email,
      u.avatar,
      t.last_time,
      t.unread_count,
      (
        SELECT message FROM messages
        WHERE sender_id = u.id OR receiver_id = u.id
        ORDER BY created_at DESC
        LIMIT 1
      ) AS last_message
    FROM users u
    INNER JOIN (
      SELECT
        sender_id AS uid,
        MAX(created_at) AS last_time,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread_count
      FROM messages
      WHERE sender_id IN (SELECT id FROM users WHERE role = 'user')
      GROUP BY sender_id

      UNION

      SELECT
        receiver_id AS uid,
        MAX(created_at) AS last_time,
        0 AS unread_count
      FROM messages
      WHERE receiver_id IN (SELECT id FROM users WHERE role = 'user')
      GROUP BY receiver_id
    ) t ON t.uid = u.id
    WHERE u.role = 'user'
    GROUP BY u.id, u.name, u.email, u.avatar, t.last_time
    ORDER BY t.last_time DESC
  `);
  return res.json(rows);
}

/**
 * GET /api/chat/thread/:userId
 */
async function getThread(req, res, next) {
  const adminId = req.user.id;
  const userId  = Number(req.params.userId);
  if (!userId) return next(new AppError("userId không hợp lệ", 400));

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
 * POST /api/chat/send — Admin gửi tin
 */
async function adminSend(req, res, next) {
  const senderId              = req.user.id;
  const { receiver_id, message } = req.body;

  if (!receiver_id)       return next(new AppError("Thiếu receiver_id", 400));
  if (!message?.trim())   return next(new AppError("Thiếu nội dung message", 400));

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
    message    : "Đã gửi",
    id         : result.insertId,
    sender_id  : senderId,
    receiver_id: Number(receiver_id),
    content    : message.trim(),
    created_at : new Date(),
  });
}

// ─── User endpoints ───────────────────────────────────────────────────────────

async function userSend(req, res, next) {
  const senderId    = req.user.id;
  const { message } = req.body;

  if (!message?.trim()) return next(new AppError("Thiếu nội dung message", 400));

  const admins = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
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

async function userGetThread(req, res) {
  const userId = req.user.id;

  const admins = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!admins.length) return res.json([]);
  const adminId = admins[0].id;

  const rows = await query(
    `SELECT
       m.id, m.sender_id, m.receiver_id, m.message, m.is_read, m.created_at,
       u.name AS sender_name, u.avatar AS sender_avatar
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

async function userUnreadCount(req, res) {
  const userId = req.user.id;
  const [row] = await query(
    "SELECT COUNT(*) AS unread_count FROM messages WHERE receiver_id = ? AND is_read = 0",
    [userId]
  );
  return res.json({ unread_count: row.unread_count });
}

async function userMarkRead(req, res) {
  const userId = req.user.id;
  await execute(
    "UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND is_read = 0",
    [userId]
  );
  return res.json({ message: "Đã đánh dấu đọc" });
}

module.exports = {
  getConversations,
  getThread,
  adminSend,
  userSend,
  userGetThread,
  userUnreadCount,
  userMarkRead,
};