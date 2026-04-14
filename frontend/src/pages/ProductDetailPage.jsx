import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import { useStore } from "../store/useStore";
import ProductCard from "../components/ProductCard";
import { formatPrice } from "../utils/format";

const StarRating = ({ rating, max = 5 }) => (
  <span className="flex items-center gap-0.5">
    {Array.from({ length: max }, (_, i) => (
      <svg key={i} className={`h-3.5 w-3.5 ${i < Math.round(rating) ? "text-amber-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </span>
);

function ReviewCard({ review }) {
  const imgSrc = review.image
    ? review.image.startsWith("http")
      ? review.image
      : `http://localhost:5000${review.image}`
    : null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-sm font-bold text-white">
            {(review.name || "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{review.name}</p>
            <StarRating rating={review.rating} />
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed">{review.comment}</p>
      {imgSrc && (
        <img
          src={imgSrc}
          alt="review"
          className="mt-3 h-20 w-20 rounded-xl object-cover border border-gray-200"
          onError={(e) => { e.target.style.display = "none"; }}
        />
      )}
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [activeImage, setActiveImage] = useState("");
  const [activeTab, setActiveTab] = useState("desc");
  const [wishlist, setWishlist] = useState(false);

  const notify = useStore((s) => s.notify);
  const triggerFlyToCart = useStore((s) => s.triggerFlyToCart);
  const increaseCartCount = useStore((s) => s.increaseCartCount);
  const isLoggedIn = !!localStorage.getItem("accessToken");

  useEffect(() => {
    window.scrollTo({ top: 0 });
    api.get(`/products/${id}`).then((res) => {
      setData(res.data);
      const firstImg = res.data.images?.[0]?.image_url || "";
        setActiveImage(firstImg ? (firstImg.startsWith("http") ? firstImg : `http://localhost:5000${firstImg}`) : "");
    });
    api.get(`/reviews/${id}`).then((res) => setReviews(res.data));
    if (isLoggedIn) {
      api.post("/view-history", { product_id: Number(id) }).catch(() => {});
    }
  }, [id, isLoggedIn]);

  const isOutOfStock = data ? data.stock === 0 : false;

  const addToCart = async (e) => {
    if (!isLoggedIn) { notify("Vui lòng đăng nhập để thêm vào giỏ hàng", "error"); return; }
    if (isOutOfStock) { notify("Sản phẩm hiện đã hết hàng", "error"); return; }
    try {
      await api.post("/cart/add", { product_id: Number(id), quantity: qty });
      const rect = e.currentTarget.getBoundingClientRect();
      triggerFlyToCart({ x: rect.left, y: rect.top });
      increaseCartCount();
      notify("✅ Đã thêm vào giỏ hàng");
    } catch (err) {
      const msg = err?.response?.data?.message || "";
      if (msg.includes("stock") || msg.includes("tồn kho")) {
        notify("⚠️ Số lượng vượt quá hàng tồn kho", "error");
      } else {
        notify("Không thể thêm vào giỏ hàng, vui lòng thử lại", "error");
      }
    }
  };

  const buyNow = async () => {
    if (!isLoggedIn) { notify("Vui lòng đăng nhập để mua hàng", "error"); navigate("/login"); return; }
    if (isOutOfStock) { notify("Sản phẩm hiện đã hết hàng", "error"); return; }
    try {
      await api.post("/cart/add", { product_id: Number(id), quantity: qty });
      increaseCartCount();
      navigate("/checkout");
    } catch (err) {
      const msg = err?.response?.data?.message || "";
      if (msg.includes("stock") || msg.includes("tồn kho")) {
        notify("⚠️ Số lượng vượt quá hàng tồn kho", "error");
      } else {
        notify("Không thể đặt mua, vui lòng thử lại", "error");
      }
    }
  };

  const preOrder = () => {
    if (!isLoggedIn) { notify("Vui lòng đăng nhập để đặt trước", "error"); navigate("/login"); return; }
    notify("🔔 Đã đăng ký đặt trước! Chúng tôi sẽ thông báo khi có hàng", "success");
  };

  const toggleWishlist = () => {
    if (!isLoggedIn) { notify("Cần đăng nhập để yêu thích", "error"); return; }
    api.post("/wishlist/toggle", { product_id: Number(id) }).catch(() => {});
    setWishlist((v) => !v);
  };

  if (!data) return (
    <div className="mx-auto max-w-7xl p-4 space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-gray-100" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-96 animate-pulse rounded-3xl bg-gray-100" />
        <div className="space-y-3">
          {[80, 60, 40, 100, 60].map((w, i) => (
            <div key={i} className={`h-5 w-${w} animate-pulse rounded-xl bg-gray-100`} style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    </div>
  );

  const salePrice = data.price - (data.price * data.discount) / 100;
  const rawImg = activeImage || data.images?.[0]?.image_url || "";
  const image = rawImg ? (rawImg.startsWith("http") ? rawImg : `http://localhost:5000${rawImg}`) : "https://placehold.co/600x600?text=Product";
  const avgRating = Number(data.avg_rating || 0).toFixed(1);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-4 space-y-4">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <button onClick={() => navigate("/")} className="hover:text-orange-500 transition-colors">Trang chủ</button>
          <span>/</span>
          <button onClick={() => navigate("/products")} className="hover:text-orange-500 transition-colors">Sản phẩm</button>
          <span>/</span>
          <span className="text-gray-600 font-medium truncate max-w-xs">{data.name}</span>
        </nav>

        {/* Main product area */}
        <div className="grid gap-5 md:grid-cols-2 rounded-3xl bg-white shadow-sm overflow-hidden">
          {/* Images */}
          <div className="p-5">
            <motion.div
              className="relative overflow-hidden rounded-2xl bg-gray-50 flex items-center justify-center"
              style={{ height: 400 }}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={image}
                  src={image}
                  alt={data.name}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="h-full w-full object-contain"
                />
              </AnimatePresence>
              {data.discount > 0 && (
                <div className="absolute top-3 left-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
                  -{data.discount}%
                </div>
              )}
            </motion.div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {data.images?.map((img) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(img.image_url?.startsWith("http") ? img.image_url : `http://localhost:5000${img.image_url}`)}
                  className={`shrink-0 h-16 w-16 overflow-hidden rounded-xl border-2 transition-all ${
                    activeImage === (img.image_url?.startsWith("http") ? img.image_url : `http://localhost:5000${img.image_url}`)
                      ? "border-orange-500 shadow-md shadow-orange-100"
                      : "border-transparent hover:border-gray-300"
                  }`}
                >
                  <img src={img.image_url?.startsWith("http") ? img.image_url : `http://localhost:5000${img.image_url}`} alt="thumb" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="p-6 flex flex-col">
            <div className="flex-1">
              <h1 className="text-2xl font-black text-gray-900 leading-tight">{data.name}</h1>

              {/* Rating row */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-amber-500">{avgRating}</span>
                  <StarRating rating={Number(avgRating)} />
                </div>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">{data.review_count} đánh giá</span>
                <span className="text-gray-300">|</span>
                <span className={`font-medium ${data.stock === 0 ? "text-red-500" : "text-gray-500"}`}>
                  {data.stock === 0 ? "🚫 Hết hàng" : `${data.stock} trong kho`}
                </span>
              </div>

              {/* Price */}
              <div className="mt-4 flex items-end gap-3 rounded-2xl bg-orange-50 px-4 py-3">
                <div className="text-3xl font-black text-[#ee4d2d]">{formatPrice(salePrice)}</div>
                {data.discount > 0 && (
                  <div className="text-sm text-gray-400 line-through mb-0.5">{formatPrice(data.price)}</div>
                )}
              </div>

              {/* Description */}
              <p className="mt-4 text-sm text-gray-600 leading-relaxed line-clamp-3">{data.description}</p>

              {/* Shipping badges */}
              <div className="mt-4 flex flex-wrap gap-2">
                {["🚚 Miễn phí vận chuyển", "🔄 Đổi trả 30 ngày", "✅ Hàng chính hãng"].map((b) => (
                  <span key={b} className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 border border-green-100">
                    {b}
                  </span>
                ))}
              </div>
            </div>

            {/* Quantity + Actions */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600">Số lượng:</span>
                <div className="flex items-center overflow-hidden rounded-xl border border-gray-200">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="flex h-10 w-10 items-center justify-center text-lg text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    −
                  </button>
                  <span className="flex h-10 w-12 items-center justify-center text-sm font-bold text-gray-800 border-x border-gray-200">
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty(qty + 1)}
                    disabled={isOutOfStock || qty >= data.stock}
                    className="flex h-10 w-10 items-center justify-center text-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                {isOutOfStock ? (
                  <>
                    <div className="flex-1 rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm font-bold text-gray-400 cursor-not-allowed select-none">
                      🚫 Hết hàng
                    </div>
                    <button
                      onClick={preOrder}
                      className="flex-1 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:brightness-105 transition-all active:scale-[0.98]"
                    >
                      🔔 Đặt trước
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={addToCart}
                      className="flex-1 rounded-2xl border-2 border-orange-500 px-4 py-3 text-sm font-bold text-orange-600 hover:bg-orange-50 transition-colors active:scale-[0.98]"
                    >
                      🛒 Thêm vào giỏ
                    </button>
                    <button
                      onClick={buyNow}
                      className="flex-1 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 hover:brightness-105 transition-all active:scale-[0.98]"
                    >
                      Mua ngay
                    </button>
                  </>
                )}
                <button
                  onClick={toggleWishlist}
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 text-lg transition-all ${wishlist ? "border-red-300 bg-red-50 text-red-500" : "border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-400"}`}
                >
                  {wishlist ? "❤️" : "🤍"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="rounded-3xl bg-white shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {[
              { key: "desc", label: "📋 Mô tả" },
              { key: "reviews", label: `⭐ Đánh giá (${reviews.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-6 py-4 text-sm font-semibold transition-colors ${
                  activeTab === tab.key ? "text-orange-600" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "desc" ? (
              <motion.div key="desc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
                <p className="text-sm text-gray-600 leading-relaxed">{data.description}</p>
              </motion.div>
            ) : (
              <motion.div key="reviews" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
                {/* Reviews list */}
                <div className="space-y-3">
                  {reviews.length === 0 ? (
                    <div className="py-10 text-center text-gray-400">
                      <div className="text-4xl mb-2">💬</div>
                      <p className="text-sm">Chưa có đánh giá nào</p>
                      <p className="text-xs mt-1 text-gray-300">Mua hàng và đánh giá qua trang đơn hàng của bạn</p>
                    </div>
                  ) : (
                    reviews.map((r) => <ReviewCard key={r.id} review={r} />)
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Related products */}
        {data.related?.length > 0 && (
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-gray-900">🔗 Sản phẩm liên quan</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {data.related.map((p, i) => (
                <ProductCard key={`rel-${p.id}-${i}`} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}