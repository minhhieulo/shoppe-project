const { query, execute, transaction } = require("../models/common.model");
const AppError = require("../utils/AppError");

// ─── Dashboard ───────────────────────────────────────────────────────────────

async function stats(_req, res) {
  const [[users], [orders], [products], [revenue], topProducts, lowStock, revenueChart, topUsers] =
    await Promise.all([
      query("SELECT COUNT(*) total FROM users"),
      query("SELECT COUNT(*) total FROM orders"),
      query("SELECT COUNT(*) total FROM products"),
      query("SELECT IFNULL(SUM(total_price),0) total FROM orders WHERE payment_status = 'paid'"),
      query(`
        SELECT p.id, p.name, IFNULL(SUM(oi.quantity), 0) sold
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        GROUP BY p.id, p.name
        ORDER BY sold DESC
        LIMIT 5`),
      query("SELECT id, name, stock FROM products WHERE stock < 10 ORDER BY stock ASC"),
      query(`
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label,
               IFNULL(SUM(total_price), 0) AS value
        FROM orders
        WHERE payment_status = 'paid'
          AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY label
        ORDER BY label ASC`),
      query(`
        SELECT u.id, u.name, u.email, COUNT(o.id) order_count, IFNULL(SUM(o.total_price), 0) total_spent
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id AND o.payment_status = 'paid'
        GROUP BY u.id, u.name, u.email
        ORDER BY total_spent DESC
        LIMIT 5`),
    ]);

  return res.json({
    totalUsers: users.total,
    totalOrders: orders.total,
    totalProducts: products.total,
    totalRevenue: revenue.total,
    topProducts,
    topUsers,
    lowStock,
    revenueChart,
  });
}

async function revenue(req, res) {
  const mode = req.query.mode || "day";
  const format = mode === "year" ? "%Y" : mode === "month" ? "%Y-%m" : "%Y-%m-%d";
  const interval = mode === "year" ? "INTERVAL 5 YEAR" : mode === "month" ? "INTERVAL 12 MONTH" : "INTERVAL 30 DAY";

  const rows = await query(
    `SELECT DATE_FORMAT(created_at, '${format}') AS label,
            IFNULL(SUM(total_price), 0) AS value,
            COUNT(*) AS count
     FROM orders
     WHERE payment_status = 'paid'
       AND created_at >= DATE_SUB(NOW(), ${interval})
     GROUP BY label
     ORDER BY label ASC`
  );
  return res.json(rows);
}

// ─── Products ────────────────────────────────────────────────────────────────

async function listProductsAdmin(_req, res) {
  const rows = await query(`
    SELECT p.*,
           c.name AS category_name,
           IFNULL(sales.total_sold, 0) AS total_sold,
           IFNULL(rv.avg_rating, 0) AS avg_rating,
           GROUP_CONCAT(pi.image_url ORDER BY pi.id SEPARATOR '||') AS images
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) total_sold FROM order_items GROUP BY product_id
    ) sales ON sales.product_id = p.id
    LEFT JOIN (
      SELECT product_id, AVG(rating) avg_rating FROM reviews GROUP BY product_id
    ) rv ON rv.product_id = p.id
    LEFT JOIN product_images pi ON pi.product_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC`);

  const formatted = rows.map((r) => ({
    ...r,
    images: r.images ? r.images.split("||") : [],
  }));
  return res.json(formatted);
}

async function createProduct(req, res) {
  const { name, price, stock, description, discount = 0, category_id, brand } = req.body;
  if (!name || !price || !stock) throw new AppError("Thiếu thông tin bắt buộc: name, price, stock", 400);

  const result = await execute(
    "INSERT INTO products(name, description, price, stock, discount, category_id, brand) VALUES(?,?,?,?,?,?,?)",
    [name.trim(), description, Number(price), Number(stock), Number(discount), category_id || null, brand]
  );
  const productId = result.insertId;

  const files = req.files || [];
  for (const file of files) {
    await execute("INSERT INTO product_images(product_id, image_url) VALUES(?,?)", [
      productId,
      `/uploads/${file.filename}`,
    ]);
  }

  return res.status(201).json({ message: "Tạo sản phẩm thành công", id: productId });
}

async function updateProduct(req, res, next) {
  const { id } = req.params;
  const { name, price, stock, description, discount = 0, category_id, brand } = req.body;

  const existing = await query("SELECT id FROM products WHERE id = ?", [id]);
  if (!existing.length) return next(new AppError("Sản phẩm không tồn tại", 404));

  await execute(
    "UPDATE products SET name=?, price=?, stock=?, description=?, discount=?, category_id=?, brand=? WHERE id=?",
    [name, Number(price), Number(stock), description, Number(discount), category_id || null, brand, id]
  );

  const files = req.files || [];
  for (const file of files) {
    await execute("INSERT INTO product_images(product_id, image_url) VALUES(?,?)", [
      id,
      `/uploads/${file.filename}`,
    ]);
  }

  return res.json({ message: "Cập nhật sản phẩm thành công" });
}

async function deleteProduct(req, res, next) {
  const { id } = req.params;
  const existing = await query("SELECT id FROM products WHERE id = ?", [id]);
  if (!existing.length) return next(new AppError("Sản phẩm không tồn tại", 404));

  await execute("DELETE FROM product_images WHERE product_id = ?", [id]);
  await execute("DELETE FROM products WHERE id = ?", [id]);
  return res.json({ message: "Xóa sản phẩm thành công" });
}

async function deleteProductImage(req, res, next) {
  const { id } = req.params; // image id
  const existing = await query("SELECT id FROM product_images WHERE id = ?", [id]);
  if (!existing.length) return next(new AppError("Ảnh không tồn tại", 404));
  await execute("DELETE FROM product_images WHERE id = ?", [id]);
  return res.json({ message: "Xóa ảnh thành công" });
}

// ─── Categories ──────────────────────────────────────────────────────────────

async function listCategoriesAdmin(_req, res) {
  const rows = await query(`
    SELECT c.*, COUNT(p.id) product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC`);
  return res.json(rows);
}

async function createCategory(req, res) {
  const name = String(req.body.name || "").trim();
  if (!name) throw new AppError("Tên danh mục không được để trống", 400);

  const existing = await query("SELECT id FROM categories WHERE name = ?", [name]);
  if (existing.length) throw new AppError("Danh mục đã tồn tại", 409);

  const result = await execute("INSERT INTO categories(name) VALUES(?)", [name]);
  return res.status(201).json({ message: "Tạo danh mục thành công", id: result.insertId });
}

async function updateCategory(req, res, next) {
  const name = String(req.body.name || "").trim();
  if (!name) return next(new AppError("Tên danh mục không được để trống", 400));

  const existing = await query("SELECT id FROM categories WHERE id = ?", [req.params.id]);
  if (!existing.length) return next(new AppError("Danh mục không tồn tại", 404));

  await execute("UPDATE categories SET name = ? WHERE id = ?", [name, req.params.id]);
  return res.json({ message: "Cập nhật danh mục thành công" });
}

async function deleteCategory(req, res, next) {
  const existing = await query("SELECT id FROM categories WHERE id = ?", [req.params.id]);
  if (!existing.length) return next(new AppError("Danh mục không tồn tại", 404));

  const inUse = await query("SELECT id FROM products WHERE category_id = ? LIMIT 1", [req.params.id]);
  if (inUse.length) return next(new AppError("Không thể xóa danh mục đang có sản phẩm", 409));

  await execute("DELETE FROM categories WHERE id = ?", [req.params.id]);
  return res.json({ message: "Xóa danh mục thành công" });
}

// ─── Orders ──────────────────────────────────────────────────────────────────

async function listOrders(req, res) {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const where = status ? "WHERE o.status = ?" : "";
  const values = status ? [status, Number(limit), offset] : [Number(limit), offset];

  const rows = await query(
    `SELECT o.*, u.name AS customer_name, u.email AS customer_email
     FROM orders o
     INNER JOIN users u ON u.id = o.user_id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`,
    values
  );
  return res.json(rows);
}

async function getOrderDetail(req, res, next) {
  const orders = await query(
    `SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.avatar
     FROM orders o
     INNER JOIN users u ON u.id = o.user_id
     WHERE o.id = ?`,
    [req.params.id]
  );
  if (!orders.length) return next(new AppError("Đơn hàng không tồn tại", 404));

  const items = await query(
    `SELECT oi.*, p.name, p.discount,
      (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) AS image
     FROM order_items oi
     INNER JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [req.params.id]
  );

  const address = await query("SELECT * FROM addresses WHERE id = ?", [orders[0].address_id || 0]);

  return res.json({ ...orders[0], items, address: address[0] || null });
}

async function updateOrderStatus(req, res, next) {
  const { status } = req.body;
  const allowed = ["placed", "confirmed", "shipping", "delivered", "cancelled"];
  if (!allowed.includes(status)) return next(new AppError("Trạng thái không hợp lệ", 400));

  const existing = await query("SELECT id, user_id, status FROM orders WHERE id = ?", [req.params.id]);
  if (!existing.length) return next(new AppError("Đơn hàng không tồn tại", 404));

  await execute("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id]);

  // Notify user
  const msgMap = {
    confirmed: "Đơn hàng của bạn đã được xác nhận",
    shipping: "Đơn hàng của bạn đang được giao",
    delivered: "Đơn hàng của bạn đã được giao thành công",
    cancelled: "Đơn hàng của bạn đã bị hủy",
  };
  if (msgMap[status]) {
    await execute(
      "INSERT INTO notifications(user_id, title, message) VALUES(?, ?, ?)",
      [existing[0].user_id, "Cập nhật đơn hàng", msgMap[status]]
    );
  }

  return res.json({ message: "Cập nhật trạng thái thành công" });
}

// ─── Users ───────────────────────────────────────────────────────────────────

async function listUsers(req, res) {
  const { role, is_blocked, q } = req.query;
  const where = [];
  const values = [];

  if (role) { where.push("u.role = ?"); values.push(role); }
  if (is_blocked !== undefined) { where.push("u.is_blocked = ?"); values.push(Number(is_blocked)); }
  if (q) { where.push("(u.name LIKE ? OR u.email LIKE ?)"); values.push(`%${q}%`, `%${q}%`); }

  const rows = await query(
    `SELECT u.id, u.name, u.email, u.role, u.is_blocked, u.avatar, u.created_at,
            COUNT(o.id) AS order_count,
            IFNULL(SUM(o.total_price), 0) AS total_spent
     FROM users u
     LEFT JOIN orders o ON o.user_id = u.id AND o.payment_status = 'paid'
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     GROUP BY u.id
     ORDER BY u.created_at DESC`,
    values
  );
  return res.json(rows);
}

async function updateUser(req, res, next) {
  const { role, is_blocked } = req.body;
  const allowed = ["user", "staff", "admin"];
  if (role && !allowed.includes(role)) return next(new AppError("Role không hợp lệ", 400));

  const existing = await query("SELECT id FROM users WHERE id = ?", [req.params.id]);
  if (!existing.length) return next(new AppError("Người dùng không tồn tại", 404));

  await execute(
    "UPDATE users SET role = ?, is_blocked = ? WHERE id = ?",
    [role, is_blocked ? 1 : 0, req.params.id]
  );
  return res.json({ message: "Cập nhật người dùng thành công" });
}

// ─── Payments ────────────────────────────────────────────────────────────────

async function listPayments(req, res) {
  const { status, method, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const where = [];
  const values = [];

  if (status) { where.push("o.payment_status = ?"); values.push(status); }
  if (method) { where.push("o.payment_method = ?"); values.push(method); }
  values.push(Number(limit), offset);

  const rows = await query(
    `SELECT o.id, o.user_id, u.name AS customer_name, u.email AS customer_email,
            o.total_price, o.payment_method, o.payment_status,
            o.transaction_id, o.paid_at, o.created_at
     FROM orders o
     INNER JOIN users u ON u.id = o.user_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`,
    values
  );
  return res.json(rows);
}

// ─── Vouchers ────────────────────────────────────────────────────────────────

async function listVouchers(_req, res) {
  // Check if voucher_code column exists on orders table
  const cols = await query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'voucher_code'`
  );
  const hasVoucherCode = cols.length > 0;

  const rows = hasVoucherCode
    ? await query(`
        SELECT v.*, COUNT(DISTINCT o.id) AS used_count
        FROM vouchers v
        LEFT JOIN orders o ON o.voucher_code = v.code
        GROUP BY v.id
        ORDER BY v.created_at DESC`)
    : await query(`
        SELECT v.*, 0 AS used_count
        FROM vouchers v
        ORDER BY v.created_at DESC`);

  return res.json(rows);
}

async function createVoucher(req, res, next) {
  const { code, discount_percent, min_order = 0, expired_at, is_active = true, max_uses } = req.body;
  if (!code || !discount_percent || !expired_at) {
    return next(new AppError("Thiếu: code, discount_percent, expired_at", 400));
  }

  const existing = await query("SELECT id FROM vouchers WHERE code = ?", [code.toUpperCase()]);
  if (existing.length) return next(new AppError("Mã voucher đã tồn tại", 409));

  const result = await execute(
    "INSERT INTO vouchers(code, discount_percent, min_order, expired_at, is_active, max_uses) VALUES(?,?,?,?,?,?)",
    [code.toUpperCase(), Number(discount_percent), Number(min_order), expired_at, is_active ? 1 : 0, max_uses || null]
  );
  return res.status(201).json({ message: "Tạo voucher thành công", id: result.insertId });
}

async function updateVoucher(req, res, next) {
  const { code, discount_percent, min_order, expired_at, is_active, max_uses } = req.body;
  const existing = await query("SELECT id FROM vouchers WHERE id = ?", [req.params.id]);
  if (!existing.length) return next(new AppError("Voucher không tồn tại", 404));

  await execute(
    "UPDATE vouchers SET code=?, discount_percent=?, min_order=?, expired_at=?, is_active=?, max_uses=? WHERE id=?",
    [code.toUpperCase(), Number(discount_percent), Number(min_order), expired_at, is_active ? 1 : 0, max_uses || null, req.params.id]
  );
  return res.json({ message: "Cập nhật voucher thành công" });
}

async function deleteVoucher(req, res, next) {
  const existing = await query("SELECT id FROM vouchers WHERE id = ?", [req.params.id]);
  if (!existing.length) return next(new AppError("Voucher không tồn tại", 404));
  await execute("DELETE FROM vouchers WHERE id = ?", [req.params.id]);
  return res.json({ message: "Xóa voucher thành công" });
}

async function applyVoucher(req, res, next) {
  const { code, total } = req.body;
  if (!code || !total) return next(new AppError("Cần cung cấp code và total", 400));

  const rows = await query(
    "SELECT * FROM vouchers WHERE code = ? AND is_active = 1 AND expired_at > NOW()",
    [code.toUpperCase()]
  );
  const voucher = rows[0];
  if (!voucher) return next(new AppError("Voucher không hợp lệ hoặc đã hết hạn", 404));
  if (Number(total) < Number(voucher.min_order)) {
    return next(new AppError(`Đơn hàng tối thiểu ${voucher.min_order.toLocaleString()}đ để dùng voucher này`, 400));
  }
  if (voucher.max_uses) {
    const usedCount = await query(
      "SELECT COUNT(*) total FROM orders WHERE voucher_code = ?",
      [voucher.code]
    );
    if (usedCount[0].total >= voucher.max_uses) {
      return next(new AppError("Voucher đã hết lượt sử dụng", 400));
    }
  }

  const discount = (Number(total) * Number(voucher.discount_percent)) / 100;
  return res.json({ discount, finalTotal: Number(total) - discount, voucher });
}

// ─── Flash Sales ─────────────────────────────────────────────────────────────

async function listFlashSales(_req, res) {
  const rows = await query(`
    SELECT fs.*, p.name AS product_name, p.price AS original_price, p.stock,
      (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) AS product_image
    FROM flash_sales fs
    INNER JOIN products p ON p.id = fs.product_id
    ORDER BY fs.start_time DESC`);
  return res.json(rows);
}

async function createFlashSale(req, res, next) {
  const { product_id, discount_percent, start_time, end_time } = req.body;
  if (!product_id || !discount_percent || !start_time || !end_time) {
    return next(new AppError("Thiếu thông tin flash sale", 400));
  }
  if (new Date(start_time) >= new Date(end_time)) {
    return next(new AppError("Thời gian bắt đầu phải trước thời gian kết thúc", 400));
  }

  const product = await query("SELECT id FROM products WHERE id = ?", [product_id]);
  if (!product.length) return next(new AppError("Sản phẩm không tồn tại", 404));

  const result = await execute(
    "INSERT INTO flash_sales(product_id, discount_percent, start_time, end_time) VALUES(?,?,?,?)",
    [product_id, Number(discount_percent), start_time, end_time]
  );
  return res.status(201).json({ message: "Tạo flash sale thành công", id: result.insertId });
}

async function updateFlashSale(req, res, next) {
  const { product_id, discount_percent, start_time, end_time } = req.body;
  const existing = await query("SELECT id FROM flash_sales WHERE id = ?", [req.params.id]);
  if (!existing.length) return next(new AppError("Flash sale không tồn tại", 404));

  await execute(
    "UPDATE flash_sales SET product_id=?, discount_percent=?, start_time=?, end_time=? WHERE id=?",
    [product_id, Number(discount_percent), start_time, end_time, req.params.id]
  );
  return res.json({ message: "Cập nhật flash sale thành công" });
}

async function deleteFlashSale(req, res, next) {
  const existing = await query("SELECT id FROM flash_sales WHERE id = ?", [req.params.id]);
  if (!existing.length) return next(new AppError("Flash sale không tồn tại", 404));
  await execute("DELETE FROM flash_sales WHERE id = ?", [req.params.id]);
  return res.json({ message: "Xóa flash sale thành công" });
}

// ─── Notifications ───────────────────────────────────────────────────────────

async function broadcastNotification(req, res, next) {
  const { title, message } = req.body;
  if (!title || !message) return next(new AppError("Cần cung cấp title và message", 400));

  const users = await query("SELECT id FROM users WHERE is_blocked = 0");
  if (!users.length) return res.json({ message: "Không có người dùng", total: 0 });

  // Batch insert for performance
  const placeholders = users.map(() => "(?,?,?)").join(",");
  const values = users.flatMap((u) => [u.id, title, message]);
  await execute(`INSERT INTO notifications(user_id, title, message) VALUES ${placeholders}`, values);

  return res.status(201).json({ message: "Gửi thông báo thành công", total: users.length });
}

async function sendNotification(req, res, next) {
  const { user_id, title, message } = req.body;
  if (!user_id || !title || !message) return next(new AppError("Cần cung cấp user_id, title, message", 400));

  const user = await query("SELECT id FROM users WHERE id = ?", [user_id]);
  if (!user.length) return next(new AppError("Người dùng không tồn tại", 404));

  await execute("INSERT INTO notifications(user_id, title, message) VALUES(?,?,?)", [user_id, title, message]);
  return res.status(201).json({ message: "Gửi thông báo thành công" });
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  stats,
  revenue,
  listProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  listCategoriesAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
  listOrders,
  getOrderDetail,
  updateOrderStatus,
  listUsers,
  updateUser,
  listPayments,
  listVouchers,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  applyVoucher,
  listFlashSales,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale,
  broadcastNotification,
  sendNotification,
};