const express = require("express");
const auth = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");
const asyncHandler = require("../utils/asyncHandler");

const {
  listProducts, productDetail, searchSuggest, popularKeywords,
  listCategories, createReview, getReviews, getBrands, getActiveFlashSales,
} = require("../controllers/shop.controller");

const {
  getCart, addCart, updateCart, removeCart, clearCart,
  toggleWishlist, getWishlist,
  createOrder, myOrders, orderDetail, cancelOrder, updateOrderAddress,
  getNotifications, readNotification, readAllNotifications,
  meProfile, updateProfile, changePassword,
  addAddress, updateAddress, deleteAddress,
  saveSearchHistory, getSearchHistory, clearSearchHistory,
  saveViewHistory, getViewHistory,
} = require("../controllers/user.controller");

const router = express.Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/products",           asyncHandler(listProducts));
router.get("/products/suggest",   asyncHandler(searchSuggest));
router.get("/products/:id",       asyncHandler(productDetail));
router.get("/categories",         asyncHandler(listCategories));
router.get("/brands",             asyncHandler(getBrands));
router.get("/flash-sales/active", asyncHandler(getActiveFlashSales));
router.get("/search/popular",     asyncHandler(popularKeywords));
router.get("/reviews/:productId", asyncHandler(getReviews));

// ─── Reviews (auth required) ──────────────────────────────────────────────────
router.post("/reviews", auth(), upload.single("image"), asyncHandler(createReview));

// ─── Cart ─────────────────────────────────────────────────────────────────────
router.get("/cart",          auth(), asyncHandler(getCart));
router.post("/cart/add",     auth(), asyncHandler(addCart));
router.put("/cart/update",   auth(), asyncHandler(updateCart));
router.delete("/cart/remove",auth(), asyncHandler(removeCart));
router.delete("/cart/clear", auth(), asyncHandler(clearCart));

// ─── Wishlist ─────────────────────────────────────────────────────────────────
router.get("/wishlist",          auth(), asyncHandler(getWishlist));
router.post("/wishlist/toggle",  auth(), asyncHandler(toggleWishlist));

// ─── Orders ───────────────────────────────────────────────────────────────────
router.post("/orders",                   auth(), asyncHandler(createOrder));
router.get("/orders/my",                 auth(), asyncHandler(myOrders));
router.get("/orders/:id",                auth(), asyncHandler(orderDetail));
router.put("/orders/:id/cancel",         auth(), asyncHandler(cancelOrder));
router.put("/orders/:id/address",        auth(), asyncHandler(updateOrderAddress)); // ← MỚI

// ─── Notifications ────────────────────────────────────────────────────────────
router.get("/notifications",         auth(), asyncHandler(getNotifications));
router.put("/notifications/read",    auth(), asyncHandler(readNotification));
router.put("/notifications/read-all",auth(), asyncHandler(readAllNotifications));

// ─── Profile ──────────────────────────────────────────────────────────────────
router.get("/profile",           auth(), asyncHandler(meProfile));
router.put("/profile",           auth(), upload.single("avatar"), asyncHandler(updateProfile));
router.put("/profile/password",  auth(), asyncHandler(changePassword));

// ─── Addresses ────────────────────────────────────────────────────────────────
router.post("/addresses",        auth(), asyncHandler(addAddress));
router.put("/addresses/:id",     auth(), asyncHandler(updateAddress));
router.delete("/addresses/:id",  auth(), asyncHandler(deleteAddress));

// ─── History ──────────────────────────────────────────────────────────────────
router.post("/search-history",         auth(), asyncHandler(saveSearchHistory));
router.get("/search-history",          auth(), asyncHandler(getSearchHistory));
router.delete("/search-history/clear", auth(), asyncHandler(clearSearchHistory));
router.post("/view-history",           auth(), asyncHandler(saveViewHistory));
router.get("/view-history",            auth(), asyncHandler(getViewHistory));

module.exports = router;