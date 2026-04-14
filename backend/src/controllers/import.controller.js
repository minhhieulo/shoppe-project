const XLSX = require("xlsx");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { execute } = require("../models/common.model");
const AppError = require("../utils/AppError");

// ✅ Trỏ đúng về backend/uploads (không phải src/controllers/uploads)
const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function downloadImage(url, productId) {
  try {
    const response = await axios.get(url.trim(), {
      responseType: "arraybuffer",
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const ext = (path.extname(new URL(url).pathname).split("?")[0] || ".jpg").toLowerCase();
    const fileName = `p${productId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, fileName), response.data);
    return `/uploads/${fileName}`;
  } catch {
    return null;
  }
}

async function pLimit(tasks, limit) {
  let i = 0;
  async function run() {
    while (i < tasks.length) {
      const idx = i++;
      await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, run));
}

async function importProducts(req, res) {
  if (!req.file) throw new AppError("Chưa upload file Excel", 400);

  const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  if (!rows.length) throw new AppError("File Excel không có dữ liệu", 400);

  for (const col of ["name", "price", "stock"]) {
    if (!(col in rows[0])) throw new AppError(`File thiếu cột bắt buộc: ${col}`, 400);
  }

  // ── BƯỚC 1: Insert tất cả products ──
  const inserted = [];
  let failed = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.name || !row.price || !row.stock) throw new Error("Thiếu name/price/stock");

      const result = await execute(
        `INSERT INTO products (name, price, stock, category_id, brand, discount, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          String(row.name).trim(),
          Number(row.price),
          Number(row.stock),
          row.category_id ? Number(row.category_id) : null,
          row.brand ? String(row.brand).trim() : null,
          row.discount ? Number(row.discount) : 0,
          row.description ? String(row.description).trim() : "",
        ]
      );

      inserted.push({
        productId: result.insertId,
        imageUrls: row.image_urls
          ? String(row.image_urls).split(",").map((u) => u.trim()).filter(Boolean)
          : [],
      });
    } catch (err) {
      failed++;
      errors.push({ row: i + 2, name: row.name || "?", error: err.message });
    }
  }

  // ── BƯỚC 2: Download ảnh song song 10 luồng ──
  const imageTasks = [];
  for (const { productId, imageUrls } of inserted) {
    for (const url of imageUrls) {
      imageTasks.push(async () => {
        const savedPath = await downloadImage(url, productId);
        if (savedPath) {
          await execute(
            "INSERT INTO product_images (product_id, image_url) VALUES (?, ?)",
            [productId, savedPath]
          );
        }
      });
    }
  }

  await pLimit(imageTasks, 10);

  return res.status(201).json({
    message: `Import hoàn tất: ${inserted.length} thành công, ${failed} thất bại`,
    total: rows.length,
    success: inserted.length,
    failed,
    errors: errors.slice(0, 20),
  });
}

module.exports = { importProducts };