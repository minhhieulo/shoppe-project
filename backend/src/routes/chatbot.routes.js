const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { ask } = require("../controllers/chatbot.controller");

const router = express.Router();

// Không cần auth — chatbot public cho cả khách chưa đăng nhập
router.post("/ask", asyncHandler(ask));

module.exports = router;