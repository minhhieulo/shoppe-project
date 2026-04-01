const { query, execute } = require("../models/common.model");
const AppError = require("../utils/AppError");

async function listProducts(req, res) {
  const {
    page = 1,
    limit = 12,
    category,
    minPrice,
    maxPrice,
    rating,
    brand,
    inStock,
    flashSale,
    sort = "newest",
    q,
  } = req.query;

  const where = [];
  const values = [];

  if (category) { where.push("p.category_id = ?"); values.push(category); }
  if (minPrice) { where.push("(p.price - p.price*p.discount/100) >= ?"); values.push(Number(minPrice)); }
  if (maxPrice) { where.push("(p.price - p.price*p.discount/100) <= ?"); values.push(Number(maxPrice)); }
  if (brand) { where.push("p.brand = ?"); values.push(brand); }
  if (inStock === "true") { where.push("p.stock > 0"); }
  if (flashSale === "true") { where.push("fs.id IS NOT NULL"); }
  if (q) {
    const fuzzy = `%${String(q).trim().split(/\s+/).join("%")}%`;
    where.push("(p.name LIKE ? OR p.description LIKE ? OR p.brand LIKE ?)");
    values.push(fuzzy, fuzzy, fuzzy);
  }
  if (rating) { where.push("IFNULL(rv.avg_rating, 0) >= ?"); values.push(Number(rating)); }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderMap = {
    newest: "p.created_at DESC",
    price_asc: "p.price ASC",
    price_desc: "p.price DESC",
    best_selling: "total_sold DESC",
    rating: "avg_rating DESC",
  };
  const orderClause = `ORDER BY ${orderMap[sort] || orderMap.newest}`;
  const offset = (Number(page) - 1) * Number(limit);

  const [rows, [countRow]] = await Promise.all([
    query(
      `SELECT p.*,
         c.name AS category_name,
         IFNULL(rv.avg_rating, 0) AS avg_rating,
         IFNULL(rv.review_count, 0) AS review_count,
         IFNULL(sales.total_sold, 0) AS total_sold,
         fs.discount_percent AS flash_discount,
         fs.end_time AS flash_end_time,
         pi.image_url AS thumbnail
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN (
         SELECT product_id, AVG(rating) avg_rating, COUNT(*) review_count
         FROM reviews GROUP BY product_id
       ) rv ON rv.product_id = p.id
       LEFT JOIN (
         SELECT product_id, SUM(quantity) total_sold
         FROM order_items GROUP BY product_id
       ) sales ON sales.product_id = p.id
       LEFT JOIN flash_sales fs
         ON fs.product_id = p.id AND NOW() BETWEEN fs.start_time AND fs.end_time
       LEFT JOIN product_images pi ON pi.product_id = p.id
       ${whereClause}
       GROUP BY p.id
       ${orderClause}
       LIMIT ? OFFSET ?`,
      [...values, Number(limit), offset]
    ),
    query(
      `SELECT COUNT(DISTINCT p.id) total
       FROM products p
       LEFT JOIN flash_sales fs ON fs.product_id = p.id AND NOW() BETWEEN fs.start_time AND fs.end_time
       LEFT JOIN (SELECT product_id, AVG(rating) avg_rating FROM reviews GROUP BY product_id) rv ON rv.product_id = p.id
       ${whereClause}`,
      values
    ),
  ]);

  return res.json({
    data: rows,
    total: countRow.total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(countRow.total / Number(limit)),
  });
}

async function searchSuggest(req, res) {
  const keyword = String(req.query.q || "").trim();
  if (!keyword) return res.json([]);
  const fuzzy = `%${keyword.split(/\s+/).join("%")}%`;
  const rows = await query(
    `SELECT id, name, price, discount,
      (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) AS thumbnail
     FROM products p
     WHERE name LIKE ? AND stock > 0
     ORDER BY created_at DESC LIMIT 8`,
    [fuzzy]
  );
  return res.json(rows);
}

async function popularKeywords(_req, res) {
  const rows = await query(
    `SELECT keyword, COUNT(*) total FROM search_history
     GROUP BY keyword ORDER BY total DESC LIMIT 10`
  );
  return res.json(rows.map((r) => r.keyword));
}

async function productDetail(req, res, next) {
  const { id } = req.params;
  const products = await query(
    `SELECT p.*, c.name category_name,
       IFNULL(rv.avg_rating, 0) avg_rating,
       IFNULL(rv.review_count, 0) review_count,
       IFNULL(sales.total_sold, 0) total_sold,
       fs.discount_percent flash_discount,
       fs.end_time flash_end_time
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN (
       SELECT product_id, AVG(rating) avg_rating, COUNT(*) review_count
       FROM reviews GROUP BY product_id
     ) rv ON rv.product_id = p.id
     LEFT JOIN (
       SELECT product_id, SUM(quantity) total_sold FROM order_items GROUP BY product_id
     ) sales ON sales.product_id = p.id
     LEFT JOIN flash_sales fs
       ON fs.product_id = p.id AND NOW() BETWEEN fs.start_time AND fs.end_time
     WHERE p.id = ?`,
    [id]
  );
  if (!products.length) return next(new AppError("Sản phẩm không tồn tại", 404));

  const [images, related, ratingBreakdown] = await Promise.all([
    query("SELECT id, image_url FROM product_images WHERE product_id = ?", [id]),
    query(
      `SELECT p.id, p.name, p.price, p.discount,
         IFNULL(rv.avg_rating,0) avg_rating,
         (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) thumbnail
       FROM products p
       LEFT JOIN (
         SELECT product_id, AVG(rating) avg_rating FROM reviews GROUP BY product_id
       ) rv ON rv.product_id = p.id
       WHERE p.category_id = ? AND p.id <> ? AND p.stock > 0
       LIMIT 8`,
      [products[0].category_id, id]
    ),
    query(
      `SELECT rating, COUNT(*) count FROM reviews WHERE product_id = ? GROUP BY rating ORDER BY rating DESC`,
      [id]
    ),
  ]);

  return res.json({ ...products[0], images, related, ratingBreakdown });
}

async function listCategories(_req, res) {
  const rows = await query(`
    SELECT c.*, COUNT(p.id) product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC`);
  return res.json(rows);
}

async function createReview(req, res, next) {
  const { product_id, rating, comment } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  if (!product_id || !rating) return next(new AppError("Thiếu product_id hoặc rating", 400));
  if (Number(rating) < 1 || Number(rating) > 5) return next(new AppError("Rating phải từ 1 đến 5", 400));

  const bought = await query(
    `SELECT oi.id FROM order_items oi
     INNER JOIN orders o ON o.id = oi.order_id
     WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'delivered'`,
    [req.user.id, product_id]
  );
  if (!bought.length) return next(new AppError("Chỉ người đã mua và nhận hàng mới được đánh giá", 403));

  const already = await query(
    "SELECT id FROM reviews WHERE user_id = ? AND product_id = ?",
    [req.user.id, product_id]
  );
  if (already.length) return next(new AppError("Bạn đã đánh giá sản phẩm này rồi", 409));

  await execute(
    "INSERT INTO reviews(user_id, product_id, rating, comment, image) VALUES(?,?,?,?,?)",
    [req.user.id, product_id, Number(rating), comment, image]
  );
  return res.status(201).json({ message: "Đánh giá thành công" });
}

async function getReviews(req, res) {
  const { page = 1, limit = 10, rating } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const where = rating ? "AND r.rating = ?" : "";
  const values = [req.params.productId, ...(rating ? [Number(rating)] : []), Number(limit), offset];

  const rows = await query(
    `SELECT r.*, u.name, u.avatar
     FROM reviews r
     INNER JOIN users u ON u.id = r.user_id
     WHERE r.product_id = ? ${where}
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?`,
    values
  );
  return res.json(rows);
}

async function getBrands(_req, res) {
  const rows = await query(
    "SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand != '' ORDER BY brand ASC"
  );
  return res.json(rows.map((r) => r.brand));
}

async function getActiveFlashSales(_req, res) {
  const rows = await query(`
    SELECT fs.*, p.name AS product_name, p.price AS original_price,
      (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) AS thumbnail
    FROM flash_sales fs
    INNER JOIN products p ON p.id = fs.product_id
    WHERE NOW() BETWEEN fs.start_time AND fs.end_time
    ORDER BY fs.end_time ASC`);
  return res.json(rows);
}

module.exports = {
  listProducts,
  productDetail,
  searchSuggest,
  popularKeywords,
  listCategories,
  createReview,
  getReviews,
  getBrands,
  getActiveFlashSales,
};