import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import ProductCard from "../components/ProductCard";
import { useStore } from "../store/useStore";
import { motion, AnimatePresence } from "framer-motion";

const FADE_UP = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const STAGGER = { show: { transition: { staggerChildren: 0.07 } } };

const CATEGORIES = [
  { label: "Điện thoại", icon: "📱", color: "from-blue-400 to-blue-600" },
  { label: "Laptop",     icon: "💻", color: "from-indigo-400 to-indigo-600" },
  { label: "Phụ kiện",   icon: "🎧", color: "from-purple-400 to-purple-600" },
  { label: "Gia dụng",   icon: "🏠", color: "from-emerald-400 to-emerald-600" },
  { label: "Thời trang", icon: "👗", color: "from-pink-400 to-pink-600" },
  { label: "Sách",       icon: "📚", color: "from-amber-400 to-amber-600" },
];

function CountdownBox({ value, label }) {
  return (
    <div className="flex flex-col items-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 font-mono text-lg font-black text-white shadow">
        {value}
      </span>
      <span className="mt-0.5 text-[9px] text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function SectionHeader({ title, emoji, href, color = "text-gray-900" }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <h2 className={`text-lg font-black ${color}`}>{title}</h2>
      </div>
      {href && (
        <Link to={href} className="flex items-center gap-1 text-xs font-semibold text-orange-500 hover:text-orange-700 transition-colors">
          Xem tất cả
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}

function ProductGrid({ products, onAddToCart, cols = "grid-cols-2 md:grid-cols-5" }) {
  return (
    <motion.div
      variants={STAGGER}
      initial="hidden"
      animate="show"
      className={`grid gap-3 ${cols}`}
    >
      {products.map((p, i) => (
        <motion.div key={`${p.id}-${i}`} variants={FADE_UP}>
          <ProductCard product={p} onAddToCart={onAddToCart} />
        </motion.div>
      ))}
    </motion.div>
  );
}

function SkeletonGrid({ count = 5, cols = "grid-cols-2 md:grid-cols-5" }) {
  return (
    <div className={`grid gap-3 ${cols}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-56 animate-pulse rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200" />
      ))}
    </div>
  );
}

export default function HomePage() {
  const [featured, setFeatured] = useState([]);
  const [latest, setLatest] = useState([]);
  const [bestSelling, setBestSelling] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [viewed, setViewed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flashDeadline] = useState(() => Date.now() + 1000 * 60 * 60 * 8);
  const [now, setNow] = useState(Date.now());

  const notify = useStore((s) => s.notify);
  const increaseCartCount = useStore((s) => s.increaseCartCount);
  const isLoggedIn = !!localStorage.getItem("accessToken");

  const extractData = (res) => (Array.isArray(res.data) ? res.data : res.data?.data ?? []);

  const addToCart = async (productId) => {
    try {
      await api.post("/cart/add", { product_id: productId, quantity: 1 });
      increaseCartCount();
      notify("✅ Đã thêm vào giỏ hàng");
    } catch {
      notify("Bạn cần đăng nhập để thêm giỏ hàng", "error");
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/products?limit=10&sort=newest"),
      api.get("/products?limit=10&sort=best_selling"),
      api.get("/products?limit=10"),
      api.get("/products?limit=20&page=1"),
    ])
      .then(([latestRes, bestRes, featureRes, suggestRes]) => {
        setLatest(extractData(latestRes));
        setBestSelling(extractData(bestRes));
        setFeatured(extractData(featureRes));
        setSuggestions(extractData(suggestRes));
      })
      .catch(() => notify("Tải sản phẩm thất bại", "error"))
      .finally(() => setLoading(false));

    if (isLoggedIn) {
      api.get("/view-history")
        .then((res) => setViewed(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    }
  }, [isLoggedIn]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remain = Math.max(0, Math.floor((flashDeadline - now) / 1000));
  const hh = String(Math.floor(remain / 3600)).padStart(2, "0");
  const mm = String(Math.floor((remain % 3600) / 60)).padStart(2, "0");
  const ss = String(remain % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 pb-12">

        {/* ── Hero Banner ─────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="pt-4 pb-3 grid gap-3 md:grid-cols-3"
        >
          {/* Main banner */}
          <div className="relative md:col-span-2 overflow-hidden rounded-3xl bg-gradient-to-r from-[#ff6b35] via-[#ee4d2d] to-[#ff8c42] p-8 text-white shadow-xl shadow-orange-200/50 min-h-[180px] flex flex-col justify-between">
            {/* dot grid */}
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle at 1.5px 1.5px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
            {/* circle accents */}
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
            <div className="absolute -right-8 bottom-0 h-40 w-40 rounded-full bg-orange-300/20" />

            <div className="relative">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm mb-3">
                🔥 Siêu Sale Hôm Nay
              </span>
              <h1 className="text-3xl md:text-4xl font-black leading-tight">
                Deal 0h — Free Ship<br />
                <span className="text-yellow-300">Toàn Quốc</span>
              </h1>
              <p className="mt-2 text-sm text-orange-100 max-w-xs">Flash Sale, voucher, ưu đãi không ngừng mỗi ngày.</p>
            </div>

            <div className="relative flex gap-3 mt-4">
              <Link to="/products" className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-orange-600 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                Mua ngay
              </Link>
              <Link to="/products?flashSale=true" className="rounded-xl border border-white/40 bg-white/10 backdrop-blur-sm px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors">
                Flash Sale
              </Link>
            </div>
          </div>

          {/* Category quick-links */}
          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Danh mục nổi bật</p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.label}
                  to={`/products?q=${c.label}`}
                  className="group flex flex-col items-center gap-1.5 rounded-2xl p-2.5 hover:bg-gray-50 transition-colors"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-xl shadow-sm group-hover:scale-110 transition-transform`}>
                    {c.icon}
                  </div>
                  <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">{c.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── Flash Sale ──────────────────────────────────────────── */}
        <section className="mb-4 rounded-3xl bg-white p-5 shadow-sm overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <h2 className="text-lg font-black text-[#ee4d2d]">Flash Sale</h2>
              <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
                Kết thúc sau
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CountdownBox value={hh} label="Giờ" />
              <span className="font-black text-gray-300 text-lg mb-4">:</span>
              <CountdownBox value={mm} label="Phút" />
              <span className="font-black text-gray-300 text-lg mb-4">:</span>
              <CountdownBox value={ss} label="Giây" />
            </div>
          </div>
          {loading ? <SkeletonGrid count={5} /> : featured.length > 0 ? (
            <ProductGrid products={featured.slice(0, 5)} onAddToCart={addToCart} />
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">Chưa có flash sale</p>
          )}
        </section>

        {/* ── Sản phẩm nổi bật ────────────────────────────────────── */}
        <section className="mb-4 rounded-3xl bg-white p-5 shadow-sm">
          <SectionHeader title="Sản phẩm nổi bật" emoji="⭐" href="/products" />
          {loading ? (
            <SkeletonGrid count={8} cols="grid-cols-2 md:grid-cols-4" />
          ) : (
            <ProductGrid products={featured.slice(0, 8)} onAddToCart={addToCart} cols="grid-cols-2 md:grid-cols-4" />
          )}
        </section>

        {/* ── 2-col row: Mới + Bán chạy ───────────────────────────── */}
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <SectionHeader title="Sản phẩm mới" emoji="🆕" href="/products?sort=newest" />
            {loading ? <SkeletonGrid count={4} cols="grid-cols-2" /> : (
              <ProductGrid products={latest.slice(0, 4)} onAddToCart={addToCart} cols="grid-cols-2" />
            )}
          </section>
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <SectionHeader title="Bán chạy nhất" emoji="🔥" href="/products?sort=best_selling" />
            {loading ? <SkeletonGrid count={4} cols="grid-cols-2" /> : (
              <ProductGrid products={bestSelling.slice(0, 4)} onAddToCart={addToCart} cols="grid-cols-2" />
            )}
          </section>
        </div>

        {/* ── Đã xem gần đây ──────────────────────────────────────── */}
        <AnimatePresence>
          {isLoggedIn && viewed.length > 0 && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4 rounded-3xl bg-white p-5 shadow-sm"
            >
              <SectionHeader title="Đã xem gần đây" emoji="👁️" />
              <ProductGrid products={viewed.slice(0, 5)} onAddToCart={addToCart} />
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── Gợi ý hôm nay ───────────────────────────────────────── */}
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <SectionHeader title="Gợi ý hôm nay" emoji="💡" href="/products" />
          {loading ? <SkeletonGrid count={10} /> : (
            <ProductGrid products={suggestions.slice(0, 10)} onAddToCart={addToCart} />
          )}
        </section>

      </div>
    </div>
  );
}