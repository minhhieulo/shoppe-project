import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../services/api";
import { formatPrice } from "../utils/format";
import { useStore } from "../store/useStore";

const STEPS = ["placed", "confirmed", "shipping", "delivered"];

const STEP_CONFIG = {
  placed:    { icon: "📋", label: "Đã đặt hàng", color: "from-blue-400 to-blue-600" },
  confirmed: { icon: "✅", label: "Đã xác nhận",  color: "from-yellow-400 to-yellow-600" },
  shipping:  { icon: "🚚", label: "Đang giao",    color: "from-orange-400 to-orange-600" },
  delivered: { icon: "📦", label: "Đã nhận hàng", color: "from-green-400 to-green-600" },
  cancelled: { icon: "❌", label: "Đã hủy",       color: "from-red-400 to-red-600" },
};

const STATUS_PILL = {
  placed:    "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-yellow-50 text-yellow-700 border-yellow-200",
  shipping:  "bg-orange-50 text-orange-700 border-orange-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const PAYMENT_PILL = {
  pending:  "bg-yellow-50 text-yellow-700",
  paid:     "bg-green-50 text-green-700",
  failed:   "bg-red-50 text-red-700",
  refunded: "bg-purple-50 text-purple-700",
};

const PAYMENT_LABEL = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  failed: "Thất bại",
  refunded: "Đã hoàn tiền",
};

function InfoRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-orange-600 text-base" : "text-gray-800"}`}>{value}</span>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const notify = useStore((s) => s.notify);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    try {
      const res = await api.get(`/orders/${id}`);
      setDetail(res.data?.items ? res.data : { order: res.data, items: [] });
    } catch {
      notify("Không tải được đơn hàng", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const order = detail?.order ?? detail;
  const items = detail?.items ?? [];
  const address = detail?.address;

  const currentStep = useMemo(() => {
    if (order?.status === "cancelled") return -1;
    return STEPS.indexOf(order?.status || "placed");
  }, [order]);

  const handleCancel = async () => {
    if (!confirm("Bạn có chắc muốn hủy đơn hàng này?")) return;
    setCancelling(true);
    try {
      await api.put(`/orders/${id}/cancel`);
      notify("✅ Hủy đơn hàng thành công");
      await load();
    } catch (err) {
      notify(err.response?.data?.message || "Không thể hủy đơn hàng", "error");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`h-${i === 1 ? 24 : i === 2 ? 48 : 32} animate-pulse rounded-3xl bg-gray-100`} style={{ height: i === 1 ? 96 : i === 2 ? 192 : 128 }} />
        ))}
      </div>
    </div>
  );

  if (!order) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 text-gray-400">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gray-100 text-5xl mb-4">😕</div>
      <p className="text-base font-semibold text-gray-600">Không tìm thấy đơn hàng</p>
      <button
        className="mt-4 rounded-2xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-200 hover:brightness-105 transition-all"
        onClick={() => navigate("/orders")}
      >
        Quay lại đơn hàng
      </button>
    </div>
  );

  const cfg = STEP_CONFIG[order.status] || STEP_CONFIG.placed;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl space-y-4 p-4">

        {/* Header card */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-white shadow-sm overflow-hidden"
        >
          <div className={`bg-gradient-to-r ${cfg.color} p-5 text-white`}>
            <button onClick={() => navigate(-1)} className="mb-2 flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors">
              ← Quay lại
            </button>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{cfg.icon}</span>
                  <h1 className="text-xl font-black">Đơn #{order.id}</h1>
                </div>
                <p className="mt-0.5 text-sm text-white/80">
                  {order.created_at ? new Date(order.created_at).toLocaleString("vi-VN") : ""}
                </p>
              </div>
              <span className="rounded-2xl bg-white/20 backdrop-blur-sm px-3 py-1.5 text-sm font-bold">
                {cfg.label}
              </span>
            </div>
          </div>

          {/* Cancel button */}
          {["placed", "confirmed"].includes(order.status) && (
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="rounded-xl border-2 border-red-200 px-4 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {cancelling ? "Đang hủy..." : "Hủy đơn hàng"}
              </button>
            </div>
          )}
        </motion.div>

        {/* Progress tracker */}
        {order.status !== "cancelled" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl bg-white p-6 shadow-sm"
          >
            <h2 className="mb-6 text-sm font-bold uppercase tracking-widest text-gray-400">Trạng thái đơn hàng</h2>
            <div className="relative">
              {/* Track line */}
              <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200" style={{ zIndex: 0 }} />
              <motion.div
                className="absolute top-5 left-5 h-0.5 bg-gradient-to-r from-orange-400 to-red-500"
                style={{ zIndex: 1 }}
                initial={{ width: 0 }}
                animate={{ width: currentStep >= 0 ? `${(currentStep / (STEPS.length - 1)) * (100 - (10 / STEPS.length * 2))}%` : "0%" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />

              <div className="relative flex justify-between" style={{ zIndex: 2 }}>
                {STEPS.map((step, idx) => {
                  const done = idx <= currentStep;
                  const cfg = STEP_CONFIG[step];
                  return (
                    <div key={step} className="flex flex-col items-center gap-2">
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: idx * 0.1 + 0.2 }}
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-base shadow-sm transition-all ${
                          done
                            ? "bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-orange-200"
                            : "bg-white border-2 border-gray-200 text-gray-400"
                        }`}
                      >
                        {cfg.icon}
                      </motion.div>
                      <span className={`text-xs font-medium text-center max-w-[60px] leading-tight ${done ? "text-orange-600" : "text-gray-400"}`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Delivery address */}
        {address && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-3xl bg-white p-5 shadow-sm"
          >
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">📍 Địa chỉ giao hàng</h2>
            <div className="rounded-2xl bg-gray-50 px-4 py-3">
              <p className="text-sm font-bold text-gray-800">{address.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">{address.phone}</p>
              <p className="text-sm text-gray-500">{address.address}{address.city ? `, ${address.city}` : ""}</p>
            </div>
          </motion.div>
        )}

        {/* Items */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-400">
            🛍️ Sản phẩm ({items.length})
          </h2>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 rounded-2xl bg-gray-50 p-3">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-16 w-16 rounded-xl object-cover border border-gray-200 shrink-0" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-200 text-2xl">📦</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">x{item.quantity}</p>
                </div>
                <p className="text-sm font-bold text-orange-600 shrink-0">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Payment details */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-3xl bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-400">💳 Thanh toán</h2>
          <div className="space-y-0">
            <InfoRow
              label="Tạm tính"
              value={formatPrice((order.total_price || 0) - (order.shipping_fee || 0) + (order.discount_amount || 0))}
            />
            {order.shipping_fee > 0 && (
              <InfoRow label="Phí vận chuyển" value={formatPrice(order.shipping_fee)} />
            )}
            {order.discount_amount > 0 && (
              <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                <span className="text-sm text-green-600">
                  Voucher {order.voucher_code ? `(${order.voucher_code})` : ""}
                </span>
                <span className="text-sm font-semibold text-green-600">-{formatPrice(order.discount_amount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <span className="text-base font-bold text-gray-800">Tổng cộng</span>
              <span className="text-xl font-black text-orange-600">{formatPrice(order.total_price)}</span>
            </div>
            <InfoRow
              label="Phương thức thanh toán"
              value={<span className="uppercase font-bold">{order.payment_method}</span>}
            />
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-gray-500">Trạng thái thanh toán</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${PAYMENT_PILL[order.payment_status] || "bg-gray-50 text-gray-600"}`}>
                {PAYMENT_LABEL[order.payment_status] || order.payment_status}
              </span>
            </div>
            {order.transaction_id && (
              <InfoRow label="Mã giao dịch" value={<span className="font-mono text-xs text-gray-500">{order.transaction_id}</span>} />
            )}
            {order.note && <InfoRow label="Ghi chú" value={order.note} />}
          </div>
        </motion.div>

      </div>
    </div>
  );
}