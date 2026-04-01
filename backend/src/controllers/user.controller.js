const bcrypt = require("bcryptjs");
const { query, execute, transaction } = require("../models/common.model");
const AppError = require("../utils/AppError");

// ─── Cart ────────────────────────────────────────────────────────────────────

async function ensureCart(userId) {
  let carts = await query("SELECT id FROM cart WHERE user_id = ?", [userId]);
  if (!carts.length) {
    const result = await execute("INSERT INTO cart(user_id) VALUES(?)", [userId]);
    return result.insertId;
  }
  return carts[0].id;
}

async function getCart(req, res) {
  const cartId = await ensureCart(req.user.id);
  const items = await query(
    `SELECT ci.id AS item_id, ci.product_id, ci.quantity,
       p.name, p.price, p.discount, p.stock,
       ROUND(p.price - p.price * p.discount / 100, 0) AS final_price,
       IFNULL(fs.discount_percent, 0) AS flash_discount,
       (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) AS image
     FROM cart_items ci
     INNER JOIN products p ON p.id = ci.product_id
     LEFT JOIN flash_sales fs
       ON fs.product_id = p.id AND NOW() BETWEEN fs.start_time AND fs.end_time
     WHERE ci.cart_id = ?`,
    [cartId]
  );

  const subtotal = items.reduce((sum, i) => {
    const price = i.flash_discount
      ? i.price - (i.price * i.flash_discount) / 100
      : i.final_price;
    return sum + price * i.quantity;
  }, 0);

  return res.json({ cartId, items, subtotal });
}

async function addCart(req, res, next) {
  const { product_id, quantity = 1 } = req.body;
  if (!product_id) return next(new AppError("Thiếu product_id", 400));

  const products = await query("SELECT id, stock FROM products WHERE id = ?", [product_id]);
  if (!products.length) return next(new AppError("Sản phẩm không tồn tại", 404));
  if (products[0].stock < quantity) return next(new AppError("Sản phẩm không đủ hàng", 400));

  const cartId = await ensureCart(req.user.id);
  const existing = await query(
    "SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?",
    [cartId, product_id]
  );

  if (existing.length) {
    const newQty = existing[0].quantity + Number(quantity);
    if (newQty > products[0].stock) return next(new AppError("Vượt quá số lượng tồn kho", 400));
    await execute("UPDATE cart_items SET quantity = ? WHERE id = ?", [newQty, existing[0].id]);
  } else {
    await execute("INSERT INTO cart_items(cart_id, product_id, quantity) VALUES(?,?,?)", [
      cartId, product_id, Number(quantity),
    ]);
  }

  return res.json({ message: "Thêm vào giỏ hàng thành công" });
}

async function updateCart(req, res, next) {
  const { item_id, quantity } = req.body;
  if (!item_id || quantity < 1) return next(new AppError("item_id và quantity >= 1 là bắt buộc", 400));

  const item = await query(
    "SELECT ci.id, p.stock FROM cart_items ci INNER JOIN products p ON p.id = ci.product_id WHERE ci.id = ?",
    [item_id]
  );
  if (!item.length) return next(new AppError("Mục giỏ hàng không tồn tại", 404));
  if (quantity > item[0].stock) return next(new AppError("Vượt quá tồn kho", 400));

  await execute("UPDATE cart_items SET quantity = ? WHERE id = ?", [quantity, item_id]);
  return res.json({ message: "Cập nhật giỏ hàng thành công" });
}

async function removeCart(req, res, next) {
  const { item_id } = req.body;
  if (!item_id) return next(new AppError("Thiếu item_id", 400));
  await execute("DELETE FROM cart_items WHERE id = ?", [item_id]);
  return res.json({ message: "Đã xóa khỏi giỏ hàng" });
}

async function clearCart(req, res) {
  const cartId = await ensureCart(req.user.id);
  await execute("DELETE FROM cart_items WHERE cart_id = ?", [cartId]);
  return res.json({ message: "Đã xóa toàn bộ giỏ hàng" });
}

// ─── Wishlist ────────────────────────────────────────────────────────────────

async function ensureWishlist(userId) {
  let rows = await query("SELECT id FROM wishlist WHERE user_id = ?", [userId]);
  if (!rows.length) {
    const result = await execute("INSERT INTO wishlist(user_id) VALUES(?)", [userId]);
    return result.insertId;
  }
  return rows[0].id;
}

async function toggleWishlist(req, res, next) {
  const { product_id } = req.body;
  if (!product_id) return next(new AppError("Thiếu product_id", 400));

  const wishlistId = await ensureWishlist(req.user.id);
  const existing = await query(
    "SELECT id FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?",
    [wishlistId, product_id]
  );

  if (existing.length) {
    await execute("DELETE FROM wishlist_items WHERE id = ?", [existing[0].id]);
    return res.json({ favorite: false, message: "Đã xóa khỏi danh sách yêu thích" });
  }
  await execute("INSERT INTO wishlist_items(wishlist_id, product_id) VALUES(?,?)", [wishlistId, product_id]);
  return res.json({ favorite: true, message: "Đã thêm vào danh sách yêu thích" });
}

async function getWishlist(req, res) {
  const rows = await query(
    `SELECT p.id, p.name, p.price, p.discount, p.stock,
       IFNULL(rv.avg_rating, 0) avg_rating,
       (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) AS image
     FROM wishlist w
     INNER JOIN wishlist_items wi ON wi.wishlist_id = w.id
     INNER JOIN products p ON p.id = wi.product_id
     LEFT JOIN (
       SELECT product_id, AVG(rating) avg_rating FROM reviews GROUP BY product_id
     ) rv ON rv.product_id = p.id
     WHERE w.user_id = ?
     ORDER BY wi.id DESC`,
    [req.user.id]
  );
  return res.json(rows);
}

// ─── Orders ──────────────────────────────────────────────────────────────────

async function createOrder(req, res, next) {
  const { address_id, payment_method = "cod", voucher_code, note } = req.body;
  const userId = req.user.id;

  return transaction(async ({ query: tq, execute: te }) => {
    const carts = await tq("SELECT id FROM cart WHERE user_id = ?", [userId]);
    if (!carts.length) return next(new AppError("Giỏ hàng trống", 400));
    const cartId = carts[0].id;

    const items = await tq(
      `SELECT ci.*, p.price, p.discount, p.stock, p.name
       FROM cart_items ci
       INNER JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = ?`,
      [cartId]
    );
    if (!items.length) return next(new AppError("Giỏ hàng trống", 400));

    // Stock check
    for (const item of items) {
      if (item.quantity > item.stock) {
        return next(new AppError(`Sản phẩm "${item.name}" không đủ hàng (còn ${item.stock})`, 400));
      }
    }

    // Calculate subtotal
    let subTotal = items.reduce((sum, item) => {
      const price = item.price - (item.price * item.discount) / 100;
      return sum + price * item.quantity;
    }, 0);

    // Voucher
    let discountAmount = 0;
    let usedVoucher = null;
    if (voucher_code) {
      const vouchers = await tq(
        "SELECT * FROM vouchers WHERE code = ? AND is_active = 1 AND expired_at > NOW()",
        [voucher_code.toUpperCase()]
      );
      const v = vouchers[0];
      if (v && subTotal >= v.min_order) {
        discountAmount = (subTotal * v.discount_percent) / 100;
        usedVoucher = v.code;
      }
    }

    const shipping = subTotal > 500000 ? 0 : 30000;
    const total = Math.max(0, subTotal + shipping - discountAmount);

    // Migration-safe INSERT: only use columns that exist in DB
    const colRows = await tq(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'`
    );
    const existingCols = new Set(colRows.map((r) => r.COLUMN_NAME));

    const insertCols = ["user_id", "total_price", "status", "payment_method", "payment_status", "transaction_id"];
    const insertVals = [userId, total, "placed", payment_method, "pending", `TXN-${Date.now()}`];

    if (existingCols.has("shipping_fee"))    { insertCols.push("shipping_fee");    insertVals.push(shipping); }
    if (existingCols.has("discount_amount")) { insertCols.push("discount_amount"); insertVals.push(discountAmount); }
    if (existingCols.has("address_id"))      { insertCols.push("address_id");      insertVals.push(address_id || null); }
    if (existingCols.has("voucher_code"))    { insertCols.push("voucher_code");    insertVals.push(usedVoucher || null); }
    if (existingCols.has("note"))            { insertCols.push("note");            insertVals.push(note || null); }

    const orderResult = await te(
      `INSERT INTO orders(${insertCols.join(",")}) VALUES(${insertVals.map(() => "?").join(",")})`,
      insertVals
    );
    const orderId = orderResult.insertId;

    for (const item of items) {
      const price = item.price - (item.price * item.discount) / 100;
      await te("INSERT INTO order_items(order_id, product_id, price, quantity) VALUES(?,?,?,?)", [
        orderId, item.product_id, price, item.quantity,
      ]);
      await te("UPDATE products SET stock = stock - ? WHERE id = ?", [item.quantity, item.product_id]);
    }

    await te("DELETE FROM cart_items WHERE cart_id = ?", [cartId]);
    await te(
      "INSERT INTO notifications(user_id, title, message) VALUES(?,?,?)",
      [userId, "Đặt hàng thành công", `Đơn hàng #${orderId} đã được tạo thành công`]
    );

    return res.status(201).json({
      message: "Đặt hàng thành công",
      orderId,
      total,
      shipping,
      discount: discountAmount,
    });
  });
}

async function myOrders(req, res) {
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const where = status ? "AND status = ?" : "";
  const values = [req.user.id, ...(status ? [status] : []), Number(limit), offset];

  const rows = await query(
    `SELECT * FROM orders WHERE user_id = ? ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    values
  );
  return res.json(rows);
}

async function orderDetail(req, res, next) {
  const orders = await query(
    `SELECT o.*, u.name customer_name FROM orders o
     INNER JOIN users u ON u.id = o.user_id
     WHERE o.id = ?`,
    [req.params.id]
  );
  if (!orders.length) return next(new AppError("Đơn hàng không tồn tại", 404));
  const order = orders[0];

  // Users can only see their own orders (staff/admin can see all)
  if (order.user_id !== req.user.id && !["admin", "staff"].includes(req.user.role)) {
    return next(new AppError("Không có quyền xem đơn hàng này", 403));
  }

  const [items, address] = await Promise.all([
    query(
      `SELECT oi.*, p.name, p.discount,
         (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) AS image
       FROM order_items oi
       INNER JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
      [req.params.id]
    ),
    query("SELECT * FROM addresses WHERE id = ?", [order.address_id || 0]),
  ]);

  return res.json({ ...order, items, address: address[0] || null });
}

async function cancelOrder(req, res, next) {
  const orders = await query("SELECT * FROM orders WHERE id = ? AND user_id = ?", [
    req.params.id, req.user.id,
  ]);
  if (!orders.length) return next(new AppError("Đơn hàng không tồn tại", 404));
  const order = orders[0];

  if (!["placed", "confirmed"].includes(order.status)) {
    return next(new AppError("Chỉ có thể hủy đơn hàng ở trạng thái đã đặt hoặc đã xác nhận", 400));
  }

  // Restore stock
  const items = await query("SELECT * FROM order_items WHERE order_id = ?", [order.id]);
  for (const item of items) {
    await execute("UPDATE products SET stock = stock + ? WHERE id = ?", [item.quantity, item.product_id]);
  }

  await execute("UPDATE orders SET status = 'cancelled' WHERE id = ?", [order.id]);

  await execute(
    "INSERT INTO notifications(user_id, title, message) VALUES(?,?,?)",
    [req.user.id, "Đơn hàng đã bị hủy", `Đơn hàng #${order.id} đã được hủy thành công`]
  );

  return res.json({ message: "Hủy đơn hàng thành công" });
}

// ─── CẬP NHẬT ĐỊA CHỈ ĐƠN HÀNG (chỉ khi status = placed) ───────────────────

async function updateOrderAddress(req, res, next) {
  const { address_id } = req.body;
  if (!address_id) return next(new AppError("Thiếu address_id", 400));

  // Kiểm tra đơn hàng tồn tại và thuộc user này
  const orders = await query(
    "SELECT * FROM orders WHERE id = ? AND user_id = ?",
    [req.params.id, req.user.id]
  );
  if (!orders.length) return next(new AppError("Đơn hàng không tồn tại", 404));
  const order = orders[0];

  // Chỉ cho sửa khi đơn ở trạng thái "placed" (chưa xác nhận)
  if (order.status !== "placed") {
    return next(new AppError("Chỉ có thể sửa địa chỉ khi đơn hàng chưa được xác nhận", 400));
  }

  // Kiểm tra địa chỉ thuộc user này
  const addresses = await query(
    "SELECT id FROM addresses WHERE id = ? AND user_id = ?",
    [address_id, req.user.id]
  );
  if (!addresses.length) return next(new AppError("Địa chỉ không hợp lệ", 404));

  await execute(
    "UPDATE orders SET address_id = ? WHERE id = ?",
    [address_id, req.params.id]
  );

  return res.json({ message: "Cập nhật địa chỉ thành công" });
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function getNotifications(req, res) {
  const rows = await query(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  return res.json(rows);
}

async function readNotification(req, res, next) {
  const { id } = req.body;
  if (!id) return next(new AppError("Thiếu id", 400));
  await execute("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [id, req.user.id]);
  return res.json({ message: "Đã đánh dấu đã đọc" });
}

async function readAllNotifications(req, res) {
  await execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [req.user.id]);
  return res.json({ message: "Đã đánh dấu tất cả là đã đọc" });
}

// ─── Profile ─────────────────────────────────────────────────────────────────

async function meProfile(req, res, next) {
  const [rows, addresses] = await Promise.all([
    query("SELECT id, name, email, avatar, role, created_at FROM users WHERE id = ?", [req.user.id]),
    query("SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC", [req.user.id]),
  ]);
  if (!rows.length) return next(new AppError("Người dùng không tồn tại", 404));
  return res.json({ user: rows[0], addresses });
}

async function updateProfile(req, res) {
  const { name, email } = req.body;
  const avatar = req.file ? `/uploads/${req.file.filename}` : null;

  if (avatar) {
    await execute("UPDATE users SET name=?, email=?, avatar=? WHERE id=?", [name, email, avatar, req.user.id]);
  } else {
    await execute("UPDATE users SET name=?, email=? WHERE id=?", [name, email, req.user.id]);
  }
  return res.json({ message: "Cập nhật hồ sơ thành công" });
}

async function changePassword(req, res, next) {
  const { oldPassword, newPassword } = req.body;
  const rows = await query("SELECT password FROM users WHERE id = ?", [req.user.id]);
  const ok = await bcrypt.compare(oldPassword, rows[0].password);
  if (!ok) return next(new AppError("Mật khẩu cũ không đúng", 400));
  if (newPassword.length < 8) return next(new AppError("Mật khẩu mới phải có ít nhất 8 ký tự", 400));

  const hashed = await bcrypt.hash(newPassword, 12);
  await execute("UPDATE users SET password = ? WHERE id = ?", [hashed, req.user.id]);
  return res.json({ message: "Đổi mật khẩu thành công" });
}

// ─── Addresses ───────────────────────────────────────────────────────────────

async function addAddress(req, res) {
  const { name, phone, address, city, is_default = false } = req.body;
  if (is_default) {
    await execute("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [req.user.id]);
  }
  const result = await execute(
    "INSERT INTO addresses(user_id, name, phone, address, city, is_default) VALUES(?,?,?,?,?,?)",
    [req.user.id, name, phone, address, city || null, is_default ? 1 : 0]
  );
  return res.status(201).json({ message: "Thêm địa chỉ thành công", id: result.insertId });
}

async function updateAddress(req, res, next) {
  const { name, phone, address, city, is_default } = req.body;
  const existing = await query("SELECT id FROM addresses WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  if (!existing.length) return next(new AppError("Địa chỉ không tồn tại", 404));

  if (is_default) {
    await execute("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [req.user.id]);
  }
  await execute(
    "UPDATE addresses SET name=?, phone=?, address=?, city=?, is_default=? WHERE id=? AND user_id=?",
    [name, phone, address, city || null, is_default ? 1 : 0, req.params.id, req.user.id]
  );
  return res.json({ message: "Cập nhật địa chỉ thành công" });
}

async function deleteAddress(req, res, next) {
  const existing = await query("SELECT id FROM addresses WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  if (!existing.length) return next(new AppError("Địa chỉ không tồn tại", 404));
  await execute("DELETE FROM addresses WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  return res.json({ message: "Xóa địa chỉ thành công" });
}

// ─── History ─────────────────────────────────────────────────────────────────

async function saveSearchHistory(req, res, next) {
  const keyword = String(req.body.keyword || "").trim();
  if (!keyword) return next(new AppError("Thiếu keyword", 400));
  await execute("INSERT INTO search_history(user_id, keyword) VALUES(?,?)", [req.user.id, keyword]);
  return res.status(201).json({ message: "Đã lưu lịch sử tìm kiếm" });
}

async function getSearchHistory(req, res) {
  const rows = await query(
    "SELECT keyword FROM search_history WHERE user_id = ? GROUP BY keyword ORDER BY MAX(created_at) DESC LIMIT 10",
    [req.user.id]
  );
  return res.json(rows.map((r) => r.keyword));
}

async function clearSearchHistory(req, res) {
  await execute("DELETE FROM search_history WHERE user_id = ?", [req.user.id]);
  return res.json({ message: "Đã xóa lịch sử tìm kiếm" });
}

async function saveViewHistory(req, res, next) {
  const productId = Number(req.body.product_id);
  if (!productId) return next(new AppError("Thiếu product_id", 400));
  await execute("DELETE FROM view_history WHERE user_id = ? AND product_id = ?", [req.user.id, productId]);
  await execute("INSERT INTO view_history(user_id, product_id) VALUES(?,?)", [req.user.id, productId]);
  return res.status(201).json({ message: "Đã lưu lịch sử xem" });
}

async function getViewHistory(req, res) {
  if (!req.user) return res.json([]);
  const rows = await query(
    `SELECT p.id, p.name, p.price, p.discount, p.stock,
       IFNULL(rv.avg_rating, 0) avg_rating,
       (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) AS image
     FROM view_history vh
     INNER JOIN products p ON p.id = vh.product_id
     LEFT JOIN (
       SELECT product_id, AVG(rating) avg_rating FROM reviews GROUP BY product_id
     ) rv ON rv.product_id = p.id
     WHERE vh.user_id = ?
     ORDER BY vh.created_at DESC LIMIT 12`,
    [req.user.id]
  );
  return res.json(rows);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  getCart, addCart, updateCart, removeCart, clearCart,
  toggleWishlist, getWishlist,
  createOrder, myOrders, orderDetail, cancelOrder, updateOrderAddress,
  getNotifications, readNotification, readAllNotifications,
  meProfile, updateProfile, changePassword,
  addAddress, updateAddress, deleteAddress,
  saveSearchHistory, getSearchHistory, clearSearchHistory,
  saveViewHistory, getViewHistory,
};