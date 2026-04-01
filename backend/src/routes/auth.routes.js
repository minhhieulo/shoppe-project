const express = require("express");
const { body } = require("express-validator");
const passport = require("../config/passport");
const {
  register, login, refresh, logout, me, forgotPassword, resetPassword,
  sendOTP, verifyOTP, oauthCallback,
} = require("../controllers/auth.controller");
const auth = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// ─── Email / Password ─────────────────────────────────────────────────────────

router.post(
  "/register",
  validate([
    body("name").trim().notEmpty().withMessage("Tên không được để trống"),
    body("email").isEmail().normalizeEmail().withMessage("Email không hợp lệ"),
    body("password").isLength({ min: 6 }).withMessage("Mật khẩu phải có ít nhất 6 ký tự"),
  ]),
  asyncHandler(register)
);

router.post(
  "/login",
  validate([
    body("email").isEmail().normalizeEmail().withMessage("Email không hợp lệ"),
    body("password").notEmpty().withMessage("Mật khẩu không được để trống"),
  ]),
  asyncHandler(login)
);

router.post("/refresh", asyncHandler(refresh));
router.post("/logout",  asyncHandler(logout));
router.post("/forgot-password", asyncHandler(forgotPassword));
router.post(
  "/reset-password",
  validate([
    body("token").notEmpty().withMessage("Thiếu token"),
    body("newPassword").isLength({ min: 6 }).withMessage("Mật khẩu phải có ít nhất 6 ký tự"),
  ]),
  asyncHandler(resetPassword)
);
router.get("/me", auth(), asyncHandler(me));

// ─── SĐT + OTP ───────────────────────────────────────────────────────────────

router.post(
  "/send-otp",
  validate([
    body("phone")
      .matches(/^(0|\+84)[3-9]\d{8}$/)
      .withMessage("Số điện thoại không hợp lệ (VD: 0912345678)"),
  ]),
  asyncHandler(sendOTP)
);

router.post(
  "/verify-otp",
  validate([
    body("phone").notEmpty().withMessage("Thiếu số điện thoại"),
    body("code").isLength({ min: 6, max: 6 }).withMessage("OTP phải đúng 6 số"),
  ]),
  asyncHandler(verifyOTP)
);

// ─── Google OAuth ─────────────────────────────────────────────────────────────

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.CLIENT_URL}/login?error=google`,
    session: false,
  }),
  asyncHandler(oauthCallback)
);

// ─── Facebook OAuth ───────────────────────────────────────────────────────────

router.get(
  "/facebook",
  passport.authenticate("facebook", { scope: ["email"], session: false })
);

router.get(
  "/facebook/callback",
  passport.authenticate("facebook", {
    failureRedirect: `${process.env.CLIENT_URL}/login?error=facebook`,
    session: false,
  }),
  asyncHandler(oauthCallback)
);

module.exports = router;