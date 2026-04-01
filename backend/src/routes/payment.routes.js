const express = require("express");
const auth = require("../middleware/auth.middleware");
const asyncHandler = require("../utils/asyncHandler");
const { query, execute } = require("../models/common.model");
const AppError = require("../utils/AppError");
const axios = require("axios");
const CryptoJS = require("crypto-js");

const router = express.Router();

function signMoMo(rawSignature) {
  const secretKey = process.env.MOMO_SECRET_KEY;
  if (!secretKey) throw new AppError("Thiếu MOMO_SECRET_KEY", 500);
  return CryptoJS.HmacSHA256(rawSignature, secretKey).toString(CryptoJS.enc.Hex);
}

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

// Create MoMo payment (sandbox)
router.post(
  "/momo/create",
  auth(),
  asyncHandler(async (req, res) => {
    const { orderId } = req.body;
    if (!orderId) throw new AppError("Thiếu orderId", 400);

    const orders = await query(
      "SELECT id, total_price, user_id, payment_status, payment_method FROM orders WHERE id = ?",
      [orderId]
    );
    if (!orders.length) throw new AppError("Đơn hàng không tồn tại", 404);
    const order = orders[0];
    if (order.user_id !== req.user.id) throw new AppError("Không có quyền", 403);
    if (order.payment_status === "paid") throw new AppError("Đơn hàng đã thanh toán", 409);

    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const endpoint = process.env.MOMO_ENDPOINT || "https://test-payment.momo.vn/v2/gateway/api/create";
    const redirectUrl = process.env.MOMO_REDIRECT_URL;
    const ipnUrl = process.env.MOMO_IPN_URL;

    if (!partnerCode || !accessKey) throw new AppError("Thiếu MOMO_PARTNER_CODE hoặc MOMO_ACCESS_KEY", 500);
    if (!redirectUrl || !ipnUrl) throw new AppError("Thiếu MOMO_REDIRECT_URL hoặc MOMO_IPN_URL", 500);

    const requestType = "payWithATM";
    const requestId = `REQ-${orderId}-${Date.now()}`;
    const momoOrderId = `ORDER-${orderId}-${Date.now()}`;
    const amount = String(Math.round(Number(order.total_price || 0)));
    const orderInfo = `Thanh toan don hang #${orderId}`;
    const extraData = Buffer.from(JSON.stringify({ orderId })).toString("base64");

    const rawSignature =
      `accessKey=${accessKey}` +
      `&amount=${amount}` +
      `&extraData=${extraData}` +
      `&ipnUrl=${ipnUrl}` +
      `&orderId=${momoOrderId}` +
      `&orderInfo=${orderInfo}` +
      `&partnerCode=${partnerCode}` +
      `&redirectUrl=${redirectUrl}` +
      `&requestId=${requestId}` +
      `&requestType=${requestType}`;

    const signature = signMoMo(rawSignature);

    const payload = {
      partnerCode,
      partnerName: "Shoppe",
      storeId: "ShoppeStore",
      requestId,
      amount,
      orderId: momoOrderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      requestType,
      extraData,
      lang: "vi",
      signature,
    };

    const { data } = await axios.post(endpoint, payload, { timeout: 15000 });

    if (Number(data?.resultCode) !== 0 || !data?.payUrl) {
      throw new AppError(data?.message || "Không tạo được thanh toán MoMo", 400);
    }

    await execute(
      "UPDATE orders SET payment_method = ?, transaction_id = ? WHERE id = ?",
      ["MOMO", data?.requestId || requestId, orderId]
    );

    return res.json({ payUrl: data.payUrl, requestId: data.requestId, momoOrderId });
  })
);

// MoMo IPN (server-to-server)
router.post(
  "/momo/ipn",
  asyncHandler(async (req, res, next) => {
    const body = req.body || {};

    const {
      partnerCode,
      orderId: momoOrderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature,
    } = body;

    if (!partnerCode || !momoOrderId || !requestId || typeof resultCode === "undefined" || !signature) {
      return next(new AppError("IPN thiếu dữ liệu", 400));
    }

    const accessKey = process.env.MOMO_ACCESS_KEY;
    if (!accessKey) return next(new AppError("Thiếu MOMO_ACCESS_KEY", 500));

    const rawSignature =
      `accessKey=${accessKey}` +
      `&amount=${amount ?? ""}` +
      `&extraData=${extraData ?? ""}` +
      `&message=${message ?? ""}` +
      `&orderId=${momoOrderId}` +
      `&orderInfo=${orderInfo ?? ""}` +
      `&orderType=${orderType ?? ""}` +
      `&partnerCode=${partnerCode}` +
      `&payType=${payType ?? ""}` +
      `&requestId=${requestId}` +
      `&responseTime=${responseTime ?? ""}` +
      `&resultCode=${resultCode}` +
      `&transId=${transId ?? ""}`;

    const expected = signMoMo(rawSignature);
    if (String(expected) !== String(signature)) {
      return next(new AppError("Chữ ký MoMo không hợp lệ", 401));
    }

    const match = String(momoOrderId).match(/^ORDER-(\d+)-/);
    if (!match) return next(new AppError("orderId không hợp lệ", 400));
    const orderId = Number(match[1]);

    const status = Number(resultCode) === 0 ? "paid" : "failed";
    await execute(
      "UPDATE orders SET payment_status = ?, transaction_id = ?, paid_at = CASE WHEN ? = 'paid' THEN NOW() ELSE paid_at END WHERE id = ?",
      [status, String(transId || requestId), status, orderId]
    );

    if (status === "paid") {
      const orders = await query("SELECT user_id FROM orders WHERE id = ?", [orderId]);
      if (orders.length) {
        await execute(
          "INSERT INTO notifications(user_id, title, message) VALUES(?,?,?)",
          [orders[0].user_id, "Thanh toán MoMo thành công", `Thanh toán đơn hàng #${orderId} đã được xác nhận`]
        );
      }
    }

    return res.json({ received: true });
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