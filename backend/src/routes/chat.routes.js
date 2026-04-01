const express = require("express");
const auth = require("../middleware/auth.middleware");
const asyncHandler = require("../utils/asyncHandler");
const {
  getConversations,
  getThread,
  adminSend,
  userSend,
  userGetThread,
  userUnreadCount,
  userMarkRead,
} = require("../controllers/chat.controller");

const router = express.Router();

// ─── Admin / Staff endpoints ──────────────────────────────────────────────────
router.get("/conversations",    auth(["admin", "staff"]), asyncHandler(getConversations));
router.get("/thread/:userId",   auth(["admin", "staff"]), asyncHandler(getThread));
router.post("/send",            auth(["admin", "staff"]), asyncHandler(adminSend));

// ─── User endpoints ───────────────────────────────────────────────────────────
router.get("/my-thread",        auth(), asyncHandler(userGetThread));
router.get("/unread-count",     auth(), asyncHandler(userUnreadCount));
router.post("/user-send",       auth(), asyncHandler(userSend));
router.post("/mark-read",       auth(), asyncHandler(userMarkRead));

module.exports = router;