import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { formatPrice } from "../utils/format";

const API_URL = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";
const PLACEHOLDER = "https://placehold.co/400x400?text=No+Image";

function getImageSrc(thumbnail) {
  if (!thumbnail) return PLACEHOLDER;
  if (thumbnail.startsWith("http")) return thumbnail;
  return `${API_URL}${thumbnail}`;
}

export default function ProductCard({ product, onWishlist, onAddToCart }) {
  const navigate = useNavigate();
  const salePrice = product.price - (product.price * product.discount) / 100;

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="group rounded-sm border border-[#e5e5e5] bg-white p-3 shadow-sm"
      onClick={() => navigate(`/products/${product.id}`)}
    >
      <img
        loading="lazy"
        src={getImageSrc(product.thumbnail)}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = PLACEHOLDER;
        }}
        alt={product.name}
        className="h-40 w-full rounded object-cover bg-gray-100"
      />
      <p className="mt-2 line-clamp-2 block text-sm font-semibold">
        {product.name}
      </p>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>Đã bán {product.total_sold || 0}</span>
        <span className="rounded bg-orange-100 px-1 text-[#ee4d2d]">-{product.discount}%</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 line-through">{formatPrice(product.price)}</p>
          <p className="font-bold text-brand">{formatPrice(salePrice)}</p>
        </div>
        <button
          className="text-xs text-pink-500"
          onClick={(e) => {
            e.stopPropagation();
            onWishlist?.(product.id);
          }}
        >
          Tim
        </button>
      </div>
      <button
        className="mt-2 w-full rounded border border-brand px-2 py-1 text-xs text-brand hover:bg-orange-50"
        onClick={(e) => {
          e.stopPropagation();
          onAddToCart?.(product.id);
        }}
      >
        Thêm vào giỏ hàng
      </button>
    </motion.div>
  );
}