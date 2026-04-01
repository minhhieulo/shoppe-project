const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");
const validate = require("../middleware/validate.middleware");
const asyncHandler = require("../utils/asyncHandler");
const {
  stats, revenue,
  listProductsAdmin, createProduct, updateProduct, deleteProduct, deleteProductImage,
  listCategoriesAdmin, createCategory, updateCategory, deleteCategory,
  listOrders, getOrderDetail, updateOrderStatus,
  listUsers, updateUser,
  listPayments,
  listVouchers, createVoucher, updateVoucher, deleteVoucher, applyVoucher,
  listFlashSales, createFlashSale, updateFlashSale, deleteFlashSale,
  broadcastNotification, sendNotification,
} = require("../controllers/admin.controller");

const router = express.Router();
const adminOrStaff = auth(["admin", "staff"]);
const adminOnly = auth(["admin"]);

// ─── Dashboard ───────────────────────────────────────────────────────────────
router.get("/stats",   adminOrStaff, asyncHandler(stats));
router.get("/revenue", adminOrStaff, asyncHandler(revenue));

// ─── Products ────────────────────────────────────────────────────────────────
router.get("/products",              adminOrStaff, asyncHandler(listProductsAdmin));
router.post("/products",             adminOrStaff, upload.array("images", 8), asyncHandler(createProduct));
router.put("/products/:id",          adminOrStaff, upload.array("images", 8), asyncHandler(updateProduct));
router.delete("/products/:id",       adminOnly,    asyncHandler(deleteProduct));
router.delete("/product-images/:id", adminOrStaff, asyncHandler(deleteProductImage));

// ─── Categories ──────────────────────────────────────────────────────────────
router.get("/categories",      adminOrStaff, asyncHandler(listCategoriesAdmin));
router.post("/categories",     adminOrStaff, asyncHandler(createCategory));
router.put("/categories/:id",  adminOrStaff, asyncHandler(updateCategory));
router.delete("/categories/:id", adminOnly,  asyncHandler(deleteCategory));

// ─── Orders ──────────────────────────────────────────────────────────────────
router.get("/orders",           adminOrStaff, asyncHandler(listOrders));
router.get("/orders/:id",       adminOrStaff, asyncHandler(getOrderDetail));
router.put("/orders/:id/status",adminOrStaff, asyncHandler(updateOrderStatus));

// ─── Users ───────────────────────────────────────────────────────────────────
router.get("/users",      adminOnly, asyncHandler(listUsers));
router.put("/users/:id",  adminOnly, asyncHandler(updateUser));

// ─── Payments ────────────────────────────────────────────────────────────────
router.get("/payments", adminOrStaff, asyncHandler(listPayments));

// ─── Vouchers ────────────────────────────────────────────────────────────────
router.get("/vouchers",       adminOrStaff, asyncHandler(listVouchers));
router.post("/vouchers",      adminOrStaff, asyncHandler(createVoucher));
router.put("/vouchers/:id",   adminOrStaff, asyncHandler(updateVoucher));
router.delete("/vouchers/:id",adminOnly,    asyncHandler(deleteVoucher));
router.post("/vouchers/apply",auth(),       asyncHandler(applyVoucher));

// ─── Flash Sales ─────────────────────────────────────────────────────────────
router.get("/flash-sales",        adminOrStaff, asyncHandler(listFlashSales));
router.post("/flash-sales",       adminOrStaff, asyncHandler(createFlashSale));
router.put("/flash-sales/:id",    adminOrStaff, asyncHandler(updateFlashSale));
router.delete("/flash-sales/:id", adminOnly,    asyncHandler(deleteFlashSale));

// ─── Notifications ───────────────────────────────────────────────────────────
router.post(
  "/notifications/broadcast",
  adminOnly,
  validate([
    body("title").notEmpty().withMessage("Thiếu tiêu đề"),
    body("message").notEmpty().withMessage("Thiếu nội dung"),
  ]),
  asyncHandler(broadcastNotification)
);
router.post(
  "/notifications/send",
  adminOnly,
  validate([
    body("user_id").isInt().withMessage("user_id phải là số"),
    body("title").notEmpty(),
    body("message").notEmpty(),
  ]),
  asyncHandler(sendNotification)
);

module.exports = router;