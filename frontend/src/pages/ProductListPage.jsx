import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import ProductCard from "../components/ProductCard";
import { useStore } from "../store/useStore";
import { motion, AnimatePresence } from "framer-motion";

const STAGGER = { show: { transition: { staggerChildren: 0.05 } } };
const FADE_UP = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

function FilterTag({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
      {label}
      <button onClick={onRemove} className="ml-0.5 text-orange-400 hover:text-orange-700">×</button>
    </span>
  );
}

function RangeSlider({ label, min, max, value, onChange }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-medium text-orange-600">{value.toLocaleString()}đ</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-orange-500"
      />
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{min.toLocaleString()}</span>
        <span>{max.toLocaleString()}</span>
      </div>
    </div>
  );
}

function SortOption({ value, current, onChange, children }) {
  return (
    <button
      onClick={() => onChange(value)}
      className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
        current === value
          ? "bg-orange-500 text-white shadow-md shadow-orange-200"
          : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600"
      }`}
    >
      {children}
    </button>
  );
}

export default function ProductListPage() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchParams] = useSearchParams();

  const [filter, setFilter] = useState({
    q: "",
    category: "",
    sort: "newest",
    minPrice: "",
    maxPrice: "",
    rating: "",
    brand: "",
    inStock: false,
    flashSale: false,
  });

  const notify = useStore((s) => s.notify);
  const increaseCartCount = useStore((s) => s.increaseCartCount);

  useEffect(() => {
    api.get("/categories").then((res) => setCategories(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const q = searchParams.get("q") || "";
    const flashSale = searchParams.get("flashSale") === "true";
    const sort = searchParams.get("sort") || "newest";
    setFilter((prev) => ({ ...prev, q, flashSale, sort }));
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .get("/products", { params: { ...filter, page, limit: 20 } })
        .then((res) => {
          const rows = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
          const tot = res.data?.total ?? rows.length;
          const tp = res.data?.totalPages ?? 1;
          setProducts((prev) => (page === 1 ? rows : [...prev, ...rows]));
          setTotal(tot);
          setTotalPages(tp);
        })
        .catch(() => notify("Tải sản phẩm thất bại", "error"))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [filter, page]);

  const setField = useCallback((name, value) => {
    setPage(1);
    setFilter((prev) => ({ ...prev, [name]: value }));
  }, []);

  const resetFilter = () => {
    setPage(1);
    setFilter({ q: "", category: "", sort: "newest", minPrice: "", maxPrice: "", rating: "", brand: "", inStock: false, flashSale: false });
  };

  const addToCart = async (productId) => {
    try {
      await api.post("/cart/add", { product_id: productId, quantity: 1 });
      increaseCartCount();
      notify("✅ Đã thêm vào giỏ hàng");
    } catch {
      notify("Bạn cần đăng nhập để thêm giỏ hàng", "error");
    }
  };

  const toggleWishlist = async (productId) => {
    try {
      await api.post("/wishlist/toggle", { product_id: productId });
      notify("💖 Đã cập nhật yêu thích");
    } catch {
      notify("Cần đăng nhập để yêu thích", "error");
    }
  };

  const popularKeywords = useMemo(() => ["iPhone", "Laptop", "Tai nghe", "Điện thoại", "Phụ kiện", "Gaming"], []);

  // Active filter tags
  const activeTags = useMemo(() => {
    const tags = [];
    if (filter.q) tags.push({ label: `"${filter.q}"`, clear: () => setField("q", "") });
    if (filter.brand) tags.push({ label: filter.brand, clear: () => setField("brand", "") });
    if (filter.inStock) tags.push({ label: "Còn hàng", clear: () => setField("inStock", false) });
    if (filter.flashSale) tags.push({ label: "⚡ Flash Sale", clear: () => setField("flashSale", false) });
    if (filter.rating) tags.push({ label: `≥ ${filter.rating} sao`, clear: () => setField("rating", "") });
    return tags;
  }, [filter]);

  const hasMore = page < totalPages;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-4">

        {/* Sort bar (top) */}
        <div className="mb-3 flex items-center gap-2 flex-wrap rounded-2xl bg-white px-4 py-3 shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Sắp xếp:</span>
          {[
            { value: "newest", label: "Mới nhất" },
            { value: "best_selling", label: "🔥 Bán chạy" },
            { value: "price_asc", label: "Giá ↑" },
            { value: "price_desc", label: "Giá ↓" },
            { value: "rating", label: "⭐ Đánh giá" },
          ].map((s) => (
            <SortOption key={s.value} value={s.value} current={filter.sort} onChange={(v) => setField("sort", v)}>
              {s.label}
            </SortOption>
          ))}
          <div className="ml-auto text-sm text-gray-500">
            {loading ? "Đang tải..." : <span><b className="text-gray-800">{total.toLocaleString()}</b> sản phẩm</span>}
          </div>
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="hidden ml-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 md:hidden"
          >
            🔧 Bộ lọc
          </button>
        </div>

        {/* Active filter tags */}
        {activeTags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-400">Đang lọc:</span>
            {activeTags.map((t) => (
              <FilterTag key={t.label} label={t.label} onRemove={t.clear} />
            ))}
            <button onClick={resetFilter} className="text-xs text-red-400 hover:text-red-600 font-medium">
              Xóa tất cả ×
            </button>
          </div>
        )}

        <div className="flex gap-4">
          {/* ── Sidebar ──────────────────────────────────────────── */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.aside
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="hidden md:block w-56 shrink-0 space-y-3"
              >
                {/* Search */}
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">Tìm kiếm</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                    <input
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all"
                      placeholder="Nhập từ khóa..."
                      value={filter.q}
                      onChange={(e) => setField("q", e.target.value)}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {popularKeywords.map((k) => (
                      <button
                        key={k}
                        onClick={() => setField("q", k)}
                        className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Danh mục */}
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">Danh mục</p>
                  <div className="space-y-0.5">
                    <button
                      onClick={() => setField("category", "")}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${!filter.category ? "bg-orange-50 text-orange-600" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      Tất cả
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setField("category", c.id)}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${filter.category == c.id ? "bg-orange-50 font-semibold text-orange-600" : "text-gray-600 hover:bg-gray-50"}`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Giá */}
                <div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Khoảng giá</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100"
                      placeholder="Từ (đ)"
                      type="number"
                      value={filter.minPrice}
                      onChange={(e) => setField("minPrice", e.target.value)}
                    />
                    <input
                      className="rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100"
                      placeholder="Đến (đ)"
                      type="number"
                      value={filter.maxPrice}
                      onChange={(e) => setField("maxPrice", e.target.value)}
                    />
                  </div>
                </div>

                {/* Thương hiệu + Đánh giá */}
                <div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Thương hiệu</p>
                  <input
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100"
                    placeholder="Apple, Samsung..."
                    value={filter.brand}
                    onChange={(e) => setField("brand", e.target.value)}
                  />

                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-3">Đánh giá</p>
                  <div className="space-y-1">
                    {[
                      { value: "", label: "Tất cả" },
                      { value: "4", label: "⭐⭐⭐⭐ trở lên" },
                      { value: "3", label: "⭐⭐⭐ trở lên" },
                    ].map((r) => (
                      <button
                        key={r.value}
                        onClick={() => setField("rating", r.value)}
                        className={`w-full rounded-xl px-3 py-1.5 text-left text-xs transition-colors ${filter.rating === r.value ? "bg-orange-50 font-semibold text-orange-600" : "text-gray-600 hover:bg-gray-50"}`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filters toggle */}
                <div className="rounded-2xl bg-white p-4 shadow-sm space-y-2">
                  {[
                    { field: "inStock", label: "✅ Còn hàng" },
                    { field: "flashSale", label: "⚡ Flash Sale" },
                  ].map(({ field, label }) => (
                    <label key={field} className="flex cursor-pointer items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <div
                        onClick={() => setField(field, !filter[field])}
                        className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${filter[field] ? "bg-orange-500" : "bg-gray-200"}`}
                      >
                        <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${filter[field] ? "left-6" : "left-1"}`} />
                      </div>
                    </label>
                  ))}
                </div>

                <button
                  onClick={resetFilter}
                  className="w-full rounded-2xl border-2 border-dashed border-orange-200 py-2.5 text-sm font-semibold text-orange-500 hover:bg-orange-50 transition-colors"
                >
                  🗑 Xóa bộ lọc
                </button>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* ── Product grid ─────────────────────────────────────── */}
          <section className="flex-1 min-w-0">
            <motion.div
              variants={STAGGER}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 gap-3 md:grid-cols-4"
            >
              {products.map((p) => (
                <motion.div key={p.id} variants={FADE_UP}>
                  <ProductCard
                    product={p}
                    onWishlist={toggleWishlist}
                    onAddToCart={addToCart}
                  />
                </motion.div>
              ))}

              {loading && page === 1 &&
                Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="h-60 animate-pulse rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200" />
                ))
              }
            </motion.div>

            {/* Empty state */}
            {!loading && products.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-24 text-gray-400"
              >
                <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-gray-100 text-5xl">
                  🔍
                </div>
                <p className="text-base font-semibold text-gray-600">Không tìm thấy sản phẩm</p>
                <p className="mt-1 text-sm">Thử thay đổi bộ lọc hoặc tìm kiếm khác</p>
                <button
                  className="mt-5 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-200 hover:brightness-105 transition-all"
                  onClick={resetFilter}
                >
                  Xóa bộ lọc
                </button>
              </motion.div>
            )}

            {/* Load more */}
            {!loading && hasMore && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 w-full rounded-2xl border-2 border-orange-200 py-3.5 text-sm font-bold text-orange-600 hover:bg-orange-50 transition-colors"
                onClick={() => setPage((p) => p + 1)}
              >
                Xem thêm sản phẩm
              </motion.button>
            )}

            {loading && page > 1 && (
              <div className="mt-6 flex justify-center">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                  Đang tải thêm...
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}