const express = require("express");
const auth = require("../middleware/auth.middleware");
const asyncHandler = require("../utils/asyncHandler");
const { query, execute } = require("../models/common.model");
const AppError = require("../utils/AppError");

const router = express.Router();

// Create a mock payment session (replace with real provider in production)
router.post(
  "/create-session",
  auth(),
  asyncHandler(async (req, res) => {
    const { method, orderId } = req.body;
    if (!method || !orderId) throw new AppError("Thiếu method hoặc orderId", 400);

    const orders = await query("SELECT id, total_price, user_id FROM orders WHERE id = ?", [orderId]);
    if (!orders.length) throw new AppError("Đơn hàng không tồn tại", 404);
    if (orders[0].user_id !== req.user.id) throw new AppError("Không có quyền", 403);

    return res.json({
      checkoutUrl: `${process.env.CLIENT_URL}/checkout/success?orderId=${orderId}&method=${method}`,
      sessionId: `sess_${Date.now()}`,
      amount: orders[0].total_price,
    });
  })
);

// Webhook — called by payment provider after successful payment
// Secured by a shared secret header
router.post(
  "/webhook",
  asyncHandler(async (req, res, next) => {
    const secret = req.headers["x-webhook-secret"];
    if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
      return next(new AppError("Webhook secret không hợp lệ", 401));
    }

    const { orderId, transactionId, status = "paid" } = req.body;
    if (!orderId) return next(new AppError("Thiếu orderId", 400));

    const allowedStatus = ["paid", "failed", "refunded"];
    if (!allowedStatus.includes(status)) return next(new AppError("Trạng thái không hợp lệ", 400));

    await execute(
      "UPDATE orders SET payment_status = ?, transaction_id = ?, paid_at = NOW() WHERE id = ?",
      [status, transactionId || `TXN-${Date.now()}`, orderId]
    );

    // Notify user
    if (status === "paid") {
      const orders = await query("SELECT user_id FROM orders WHERE id = ?", [orderId]);
      if (orders.length) {
        await execute(
          "INSERT INTO notifications(user_id, title, message) VALUES(?,?,?)",
          [orders[0].user_id, "Thanh toán thành công", `Thanh toán đơn hàng #${orderId} đã được xác nhận`]
        );
      }
    }

    return res.json({ received: true });
  })
);

// Get payment status for an order
router.get(
  "/status/:id",
  auth(),
  asyncHandler(async (req, res, next) => {
    const rows = await query(
      "SELECT id, payment_status, transaction_id, payment_method, paid_at, total_price FROM orders WHERE id = ?",
      [req.params.id]
    );
    if (!rows.length) return next(new AppError("Đơn hàng không tồn tại", 404));
    return res.json(rows[0]);
  })
);

// Refund request (admin only)
router.post(
  "/refund/:orderId",
  auth(["admin"]),
  asyncHandler(async (req, res, next) => {
    const orders = await query("SELECT * FROM orders WHERE id = ?", [req.params.orderId]);
    if (!orders.length) return next(new AppError("Đơn hàng không tồn tại", 404));
    if (orders[0].payment_status !== "paid") {
      return next(new AppError("Chỉ hoàn tiền đơn hàng đã thanh toán", 400));
    }

    await execute(
      "UPDATE orders SET payment_status = 'refunded' WHERE id = ?",
      [req.params.orderId]
    );
    await execute(
      "INSERT INTO notifications(user_id, title, message) VALUES(?,?,?)",
      [orders[0].user_id, "Hoàn tiền thành công", `Đơn hàng #${req.params.orderId} đã được hoàn tiền`]
    );

    return res.json({ message: "Hoàn tiền thành công" });
  })
);

module.exports = router;