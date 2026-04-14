const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth.middleware");
const asyncHandler = require("../utils/asyncHandler");
const { importProducts } = require("../controllers/import.controller");

const router = express.Router();

// Nhận file Excel trong memory (không lưu disk trước)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // tối đa 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel",                                           // .xls
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file .xlsx hoặc .xls"), false);
    }
  },
});

const adminOrStaff = auth(["admin", "staff"]);

// POST /api/admin/products/import
router.post(
  "/products/import",
  adminOrStaff,
  upload.single("file"),
  asyncHandler(importProducts)
);

module.exports = router;