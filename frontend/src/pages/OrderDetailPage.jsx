import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import { formatPrice } from "../utils/format";
import { useStore } from "../store/useStore";

const STEPS = ["placed", "confirmed", "shipping", "delivered"];

const STEP_CONFIG = {
  placed:    { icon: "📋", label: "Đặt hàng",  color: "#6366f1" },
  confirmed: { icon: "✅", label: "Xác nhận",  color: "#0ea5e9" },
  shipping:  { icon: "🚚", label: "Đang giao", color: "#f59e0b" },
  delivered: { icon: "🎁", label: "Đã nhận",   color: "#10b981" },
  cancelled: { icon: "✕",  label: "Đã hủy",   color: "#ef4444" },
};

const STATUS_CONFIG = {
  placed:    { text: "Chờ xác nhận", cls: "status-indigo" },
  confirmed: { text: "Đã xác nhận", cls: "status-sky" },
  shipping:  { text: "Đang giao",   cls: "status-amber" },
  delivered: { text: "Hoàn thành",  cls: "status-emerald" },
  cancelled: { text: "Đã hủy",     cls: "status-red" },
};

const PAYMENT_CONFIG = {
  pending:  { text: "Chờ thanh toán", cls: "status-amber" },
  paid:     { text: "Đã thanh toán",  cls: "status-emerald" },
  failed:   { text: "Thất bại",       cls: "status-red" },
  refunded: { text: "Đã hoàn tiền",  cls: "status-purple" },
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const notify = useStore((s) => s.notify);
  const increaseCartCount = useStore((s) => s.increaseCartCount);

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressList, setAddressList] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await api.get(`/orders/${id}`);
      const { items = [], address, ...order } = res.data;
      setDetail({ order, items, address });
      setSelectedAddressId(order.address_id || null);
    } catch {
      notify("Không tải được đơn hàng", "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(true); }, [id]);

  const openEditAddress = async () => {
    try {
      const res = await api.get("/profile");
      setAddressList(res.data.addresses || []);
      setEditingAddress(true);
    } catch {
      notify("Không tải được danh sách địa chỉ", "error");
    }
  };

  const handleSaveAddress = async () => {
    if (!selectedAddressId) return notify("Vui lòng chọn địa chỉ", "error");
    setSavingAddress(true);
    try {
      await api.put(`/orders/${id}/address`, { address_id: selectedAddressId });
      notify("✅ Cập nhật địa chỉ thành công");
      setEditingAddress(false);
      load(false);
    } catch (err) {
      notify(err.response?.data?.message || "Không thể cập nhật địa chỉ", "error");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleReorder = async () => {
    setReordering(true);
    try {
      const items = detail?.items ?? [];
      for (const item of items) {
        await api.post("/cart/add", { product_id: item.product_id, quantity: item.quantity });
      }
      increaseCartCount(items.reduce((s, i) => s + i.quantity, 0));
      notify("✅ Đã thêm vào giỏ hàng!");
      navigate("/cart");
    } catch (err) {
      notify(err.response?.data?.message || "Có lỗi khi thêm vào giỏ hàng", "error");
    } finally {
      setReordering(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setShowConfirm(false);
    try {
      await api.put(`/orders/${id}/cancel`);
      notify("✅ Hủy đơn hàng thành công");
      navigate("/orders", { replace: true, state: { cancelledAt: Date.now() } });
    } catch (err) {
      notify(err.response?.data?.message || "Không thể hủy đơn hàng", "error");
    } finally {
      setCancelling(false);
    }
  };

  /* ── Loading skeleton ── */
  if (loading) return (
    <div className="od-page">
      <style>{STYLES}</style>
      <div className="od-inner">
        <div className="od-skeleton" style={{ height: 80, borderRadius: 16 }} />
        <div className="od-skeleton" style={{ height: 140, borderRadius: 16 }} />
        <div className="od-skeleton" style={{ height: 180, borderRadius: 16 }} />
        <div className="od-skeleton" style={{ height: 200, borderRadius: 16 }} />
      </div>
    </div>
  );

  if (!detail?.order) return (
    <div className="od-page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{STYLES}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>😕</div>
        <p style={{ fontSize: 16, fontWeight: 600, color: "#64748b", marginBottom: 20 }}>Không tìm thấy đơn hàng</p>
        <button className="od-btn-primary" onClick={() => navigate("/orders")}>Quay lại danh sách đơn</button>
      </div>
    </div>
  );

  const { order, items = [], address } = detail;
  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.placed;
  const currentStep = order.status === "cancelled" ? -1 : STEPS.indexOf(order.status || "placed");
  const canEditAddress = order.status === "placed";
  const subtotal = (order.total_price || 0) - (order.shipping_fee || 0) + (order.discount_amount || 0);
  const canCancel = ["placed", "confirmed"].includes(order.status);
  const isDelivered = order.status === "delivered";
  const isCancelled = order.status === "cancelled";

  return (
    <>
      <style>{STYLES}</style>

      <div className="od-page">
        <div className="od-inner">

          {/* Back */}
          <motion.button
            className="od-back"
            onClick={() => navigate(-1)}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <span className="od-back-arrow">←</span>
            <span>Quay lại</span>
          </motion.button>

          {/* Header */}
          <motion.div
            className="od-card od-card-header"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="od-header-content">
              <div className="od-header-left">
                <div className="od-order-id">Đơn #{order.id}</div>
                <div className="od-order-date">
                  🕐 {order.created_at ? new Date(order.created_at).toLocaleString("vi-VN") : ""}
                </div>
              </div>
              <span className={`od-badge ${statusCfg.cls}`}>{statusCfg.text}</span>
            </div>

            {/* CTA Buttons */}
            <div className="od-actions">
              {canCancel && (
                <button className="od-btn-outline" onClick={() => setShowConfirm(true)} disabled={cancelling}>
                  <span>🗑</span> {cancelling ? "Đang hủy..." : "Hủy đơn"}
                </button>
              )}
              {isCancelled && (
                <button className="od-btn-primary" onClick={handleReorder} disabled={reordering}>
                  <span>🔄</span> {reordering ? "Đang xử lý..." : "Đặt lại"}
                </button>
              )}
              {isDelivered && (
                <>
                  <button className="od-btn-ghost-action" onClick={handleReorder} disabled={reordering}>
                    <span>🛒</span> {reordering ? "Đang xử lý..." : "Mua lại"}
                  </button>
                  <button className="od-btn-primary" onClick={() => navigate(`/review?order=${order.id}`)}>
                    <span>⭐</span> Đánh giá
                  </button>
                </>
              )}
              {order.status === "shipping" && (
                <button className="od-btn-ghost-action" onClick={() => notify("Tính năng đang phát triển")}>
                  <span>📞</span> Liên hệ shop
                </button>
              )}
            </div>
          </motion.div>

          {/* Progress Tracker */}
          {!isCancelled ? (
            <motion.div
              className="od-card od-card-body"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
            >
              <div className="od-section-title">📦 Trạng thái đơn hàng</div>
              <div className="od-steps">
                {STEPS.map((step, idx) => {
                  const done = idx <= currentStep;
                  const isCurrent = idx === currentStep;
                  const stepCfg = STEP_CONFIG[step];
                  const lineActive = idx < currentStep;
                  return (
                    <div key={step} className="od-step">
                      {idx < STEPS.length - 1 && (
                        <div className={`od-step-line ${lineActive ? "active" : ""}`}>
                          {lineActive && <div className="od-step-line-fill" />}
                        </div>
                      )}
                      <motion.div
                        className={`od-step-dot ${done ? "done" : "pending"} ${isCurrent ? "current" : ""}`}
                        style={done ? { background: stepCfg.color, boxShadow: `0 0 0 5px ${stepCfg.color}22, 0 4px 12px ${stepCfg.color}44` } : {}}
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: idx * 0.1 + 0.15, type: "spring", stiffness: 300 }}
                      >
                        {done ? stepCfg.icon : <span style={{ color: "#cbd5e1", fontSize: 12 }}>○</span>}
                        {isCurrent && <span className="od-step-pulse" style={{ borderColor: stepCfg.color }} />}
                      </motion.div>
                      <motion.span
                        className={`od-step-label ${done ? "done" : "pending"}`}
                        style={isCurrent ? { color: stepCfg.color, fontWeight: 700 } : {}}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.1 + 0.2 }}
                      >
                        {stepCfg.label}
                        {isCurrent && <span className="od-step-now-badge">Hiện tại</span>}
                      </motion.span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div className="od-card od-card-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
              <div className="od-cancelled-banner">
                <div className="od-cancelled-dot">✕</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#ef4444" }}>Đơn hàng đã bị hủy</div>
                  <div style={{ fontSize: 13, color: "#fca5a5", marginTop: 3 }}>Bạn có thể đặt lại bằng nút "Đặt lại" ở trên.</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Delivery Address */}
          {(address || canEditAddress) && (
            <motion.div
              className="od-card od-card-body"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div className="od-section-title" style={{ marginBottom: 0 }}>📍 Địa chỉ giao hàng</div>
                {canEditAddress && !editingAddress && (
                  <button className="od-edit-btn" onClick={openEditAddress}>Sửa địa chỉ</button>
                )}
              </div>

              {!editingAddress && address && (
                <div className="od-address-box">
                  <div className="od-address-name">{address.name} · {address.phone}</div>
                  <div className="od-address-detail">{address.address}{address.city ? `, ${address.city}` : ""}</div>
                </div>
              )}

              {editingAddress && (
                <div>
                  {addressList.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "16px 0" }}>
                      Bạn chưa có địa chỉ nào. Thêm địa chỉ trong hồ sơ.
                    </p>
                  ) : (
                    addressList.map((addr) => (
                      <div
                        key={addr.id}
                        className={`od-addr-option ${selectedAddressId === addr.id ? "selected" : ""}`}
                        onClick={() => setSelectedAddressId(addr.id)}
                      >
                        <input
                          type="radio"
                          name="address"
                          style={{ accentColor: "#ee4d2d", marginTop: 2, flexShrink: 0 }}
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{addr.name} · {addr.phone}</div>
                          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{addr.address}{addr.city ? `, ${addr.city}` : ""}</div>
                          {addr.is_default === 1 && (
                            <span style={{ display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 600, color: "#ee4d2d", background: "#fff7f5", border: "1px solid #fecaca", borderRadius: 20, padding: "2px 8px" }}>Mặc định</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="od-btn-ghost" onClick={() => setEditingAddress(false)}>Hủy</button>
                    <button
                      className="od-btn-primary"
                      style={{ flex: 1, padding: "10px" }}
                      onClick={handleSaveAddress}
                      disabled={savingAddress || !selectedAddressId}
                    >
                      {savingAddress ? "Đang lưu..." : "Lưu địa chỉ"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Products */}
          <motion.div
            className="od-card od-card-body"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
          >
            <div className="od-section-title">🛍 Sản phẩm ({items.length})</div>
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                className="od-product-row"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
              >
                <div className="od-product-img-wrap">
                  {item.image ? (
                    <img
                      className="od-product-img"
                      src={item.image.startsWith("http") ? item.image : `http://localhost:5000${item.image}`}
                      alt={item.name}
                    />
                  ) : (
                    <div className="od-product-img-placeholder">📦</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="od-product-name">{item.name}</div>
                  <div className="od-product-qty-badge">
                    <span>Số lượng:</span>
                    <strong>x{item.quantity}</strong>
                  </div>
                </div>
                <div className="od-product-price-col">
                  <div className="od-product-price">{formatPrice(item.price * item.quantity)}</div>
                  {item.quantity > 1 && (
                    <div className="od-product-unit">({formatPrice(item.price)}/cái)</div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Payment */}
          <motion.div
            className="od-card od-card-body"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
          >
            <div className="od-section-title">💳 Thanh toán</div>

            <div className="od-pay-breakdown">
              <div className="od-pay-row">
                <span className="od-pay-label">Tạm tính</span>
                <span className="od-pay-value">{formatPrice(subtotal)}</span>
              </div>

              {order.shipping_fee > 0 && (
                <div className="od-pay-row">
                  <span className="od-pay-label">🚚 Phí vận chuyển</span>
                  <span className="od-pay-value">{formatPrice(order.shipping_fee)}</span>
                </div>
              )}

              {order.discount_amount > 0 && (
                <div className="od-pay-row">
                  <span className="od-pay-label">🎟 Voucher {order.voucher_code ? `(${order.voucher_code})` : ""}</span>
                  <span className="od-discount">−{formatPrice(order.discount_amount)}</span>
                </div>
              )}
            </div>

            <div className="od-pay-total-box">
              <div className="od-pay-total">
                <span className="od-total-label">Tổng cộng</span>
                <span className="od-total-value">{formatPrice(order.total_price)}</span>
              </div>
            </div>

            <div className="od-pay-meta">
              <div className="od-pay-row-meta">
                <span className="od-pay-label">Phương thức</span>
                <span className="od-pay-method">{order.payment_method?.toUpperCase()}</span>
              </div>

              <div className="od-pay-row-meta">
                <span className="od-pay-label">Trạng thái TT</span>
                <span className={`od-badge ${(PAYMENT_CONFIG[order.payment_status] || {}).cls || "status-amber"}`}>
                  {(PAYMENT_CONFIG[order.payment_status] || {}).text || order.payment_status}
                </span>
              </div>

              {order.transaction_id && (
                <div className="od-pay-row-meta">
                  <span className="od-pay-label">Mã giao dịch</span>
                  <span className="od-mono">{order.transaction_id}</span>
                </div>
              )}

              {order.note && (
                <div className="od-pay-row-meta">
                  <span className="od-pay-label">Ghi chú</span>
                  <span className="od-pay-value">{order.note}</span>
                </div>
              )}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Cancel Confirm Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            className="od-modal-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              className="od-modal"
              initial={{ scale: 0.9, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="od-modal-icon">🗑️</div>
              <div className="od-modal-title">Hủy đơn hàng?</div>
              <div className="od-modal-sub">
                Đơn <strong>#{order.id}</strong> sẽ bị hủy vĩnh viễn và không thể hoàn tác.
              </div>
              <div className="od-modal-actions">
                <button className="od-btn-ghost" onClick={() => setShowConfirm(false)}>Giữ lại</button>
                <button className="od-btn-danger" onClick={handleCancel} disabled={cancelling}>
                  {cancelling ? "Đang hủy..." : "Xác nhận hủy"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── STYLES ──────────────────────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');

  .od-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    padding: 20px 16px 48px;
    font-family: 'Be Vietnam Pro', sans-serif;
  }
  .od-inner {
    max-width: 680px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* Skeleton */
  .od-skeleton {
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: od-shimmer 1.5s infinite;
  }
  @keyframes od-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Cards */
  .od-card {
    background: #fff;
    border-radius: 20px;
    border: 1px solid rgba(226,232,240,0.8);
    box-shadow: 0 2px 12px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04);
    overflow: hidden;
    transition: box-shadow 0.2s;
  }
  .od-card:hover {
    box-shadow: 0 4px 20px rgba(15,23,42,0.09), 0 2px 6px rgba(15,23,42,0.06);
  }
  .od-card-body { padding: 22px 22px 18px; }
  .od-card-header { }

  .od-section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #94a3b8;
    margin-bottom: 16px;
  }

  /* Status badges */
  .od-badge {
    display: inline-flex;
    align-items: center;
    padding: 5px 13px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .status-indigo  { background: #eef2ff; color: #4f46e5; }
  .status-sky     { background: #f0f9ff; color: #0284c7; }
  .status-amber   { background: #fffbeb; color: #d97706; }
  .status-emerald { background: #ecfdf5; color: #059669; }
  .status-red     { background: #fef2f2; color: #dc2626; }
  .status-purple  { background: #faf5ff; color: #7c3aed; }

  /* Header */
  .od-header-content {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 20px 22px 16px;
  }
  .od-order-id {
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
    margin-bottom: 4px;
  }
  .od-order-date {
    font-size: 12px;
    color: #94a3b8;
    font-weight: 500;
  }

  /* Action bar */
  .od-actions {
    display: flex;
    gap: 8px;
    padding: 12px 22px 18px;
    flex-wrap: wrap;
  }
  .od-btn-outline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    border: 1.5px solid #fca5a5;
    color: #dc2626;
    background: #fff;
    cursor: pointer;
    transition: all 0.18s;
    font-family: inherit;
  }
  .od-btn-outline:hover { background: #fef2f2; border-color: #f87171; transform: translateY(-1px); }
  .od-btn-outline:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

  .od-btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 20px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    background: linear-gradient(135deg, #ee4d2d 0%, #f97316 100%);
    color: #fff;
    border: none;
    cursor: pointer;
    transition: all 0.18s;
    box-shadow: 0 4px 12px rgba(238,77,45,0.3);
    font-family: inherit;
  }
  .od-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(238,77,45,0.4); }
  .od-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

  .od-btn-ghost-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    border: 1.5px solid #e2e8f0;
    color: #475569;
    background: #fff;
    cursor: pointer;
    transition: all 0.18s;
    font-family: inherit;
  }
  .od-btn-ghost-action:hover { background: #f8fafc; border-color: #cbd5e1; transform: translateY(-1px); }
  .od-btn-ghost-action:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

  /* Progress Steps */
  .od-steps {
    display: flex;
    align-items: flex-start;
    position: relative;
    padding: 8px 0 4px;
  }
  .od-step {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    gap: 0;
  }
  .od-step-line {
    position: absolute;
    top: 21px;
    left: calc(50% + 22px);
    right: calc(-50% + 22px);
    height: 3px;
    background: #e2e8f0;
    border-radius: 4px;
    z-index: 0;
    overflow: hidden;
  }
  .od-step-line.active { background: #e2e8f0; }
  .od-step-line-fill {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, #ee4d2d, #f97316);
    border-radius: 4px;
    animation: od-line-fill 0.6s ease-out forwards;
  }
  @keyframes od-line-fill {
    from { width: 0; }
    to { width: 100%; }
  }
  .od-step-dot {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    z-index: 1;
    position: relative;
    background: #f1f5f9;
    border: 2.5px solid #e2e8f0;
    transition: all 0.25s;
  }
  .od-step-dot.done {
    border: none;
  }
  .od-step-dot.current {
    transform: scale(1.15);
  }
  .od-step-pulse {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2px solid;
    opacity: 0.4;
    animation: od-pulse 2s infinite;
  }
  @keyframes od-pulse {
    0%, 100% { transform: scale(1); opacity: 0.4; }
    50% { transform: scale(1.2); opacity: 0; }
  }
  .od-step-label {
    font-size: 11px;
    margin-top: 8px;
    text-align: center;
    max-width: 68px;
    line-height: 1.4;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .od-step-label.done { color: #475569; font-weight: 600; }
  .od-step-label.pending { color: #cbd5e1; font-weight: 500; }
  .od-step-now-badge {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    background: linear-gradient(135deg, #ee4d2d, #f97316);
    color: #fff;
    padding: 2px 7px;
    border-radius: 20px;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  /* Cancelled banner */
  .od-cancelled-banner {
    background: linear-gradient(135deg, #fef2f2, #fff5f5);
    border: 1.5px solid #fecaca;
    border-radius: 14px;
    padding: 16px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .od-cancelled-dot {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #fee2e2;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
    font-weight: 700;
    color: #ef4444;
  }

  /* Address */
  .od-address-box {
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 14px;
    padding: 16px 18px;
  }
  .od-address-name {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 4px;
  }
  .od-address-detail { font-size: 13px; color: #64748b; line-height: 1.6; }
  .od-edit-btn {
    font-size: 12px;
    font-weight: 700;
    color: #ee4d2d;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 8px;
    transition: background 0.15s;
  }
  .od-edit-btn:hover { background: #fff7f5; }

  /* Address picker */
  .od-addr-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 13px 15px;
    border-radius: 12px;
    border: 1.5px solid #e2e8f0;
    cursor: pointer;
    transition: all 0.15s;
    margin-bottom: 8px;
  }
  .od-addr-option.selected { border-color: #ee4d2d; background: #fff7f5; }
  .od-addr-option:hover:not(.selected) { border-color: #94a3b8; }

  /* Product rows */
  .od-product-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 0;
    transition: background 0.15s;
    border-radius: 12px;
    margin: 0 -8px;
    padding-left: 8px;
    padding-right: 8px;
  }
  .od-product-row:not(:last-child) { border-bottom: 1px solid #f1f5f9; }
  .od-product-row:hover { background: #f8fafc; }
  .od-product-img-wrap {
    position: relative;
    flex-shrink: 0;
  }
  .od-product-img {
    width: 68px;
    height: 68px;
    border-radius: 14px;
    object-fit: cover;
    border: 1px solid #f1f5f9;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  .od-product-img-placeholder {
    width: 68px;
    height: 68px;
    border-radius: 14px;
    background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
  }
  .od-product-name {
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    margin-bottom: 6px;
  }
  .od-product-qty-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #64748b;
    background: #f1f5f9;
    padding: 3px 10px;
    border-radius: 20px;
  }
  .od-product-qty-badge strong { color: #334155; }
  .od-product-price-col { text-align: right; margin-left: auto; }
  .od-product-price {
    font-size: 15px;
    font-weight: 800;
    color: #ee4d2d;
    white-space: nowrap;
  }
  .od-product-unit {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 2px;
  }

  /* Payment breakdown */
  .od-pay-breakdown {
    background: #f8fafc;
    border-radius: 14px;
    padding: 14px 16px;
    margin-bottom: 2px;
  }
  .od-pay-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 0;
    font-size: 14px;
  }
  .od-pay-row:not(:last-child) { border-bottom: 1px solid #f1f5f9; }
  .od-pay-label { color: #64748b; font-weight: 500; }
  .od-pay-value { color: #334155; font-weight: 600; }
  .od-discount { color: #10b981; font-weight: 700; }

  /* Total box */
  .od-pay-total-box {
    background: linear-gradient(135deg, #fff7f5, #fff5f0);
    border: 1.5px solid #fed7aa;
    border-radius: 16px;
    padding: 16px 20px;
    margin: 14px 0;
  }
  .od-pay-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .od-total-label {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
  }
  .od-total-value {
    font-size: 26px;
    font-weight: 800;
    color: #ee4d2d;
    letter-spacing: -0.02em;
  }

  /* Payment meta */
  .od-pay-meta { }
  .od-pay-row-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    font-size: 14px;
    border-bottom: 1px solid #f1f5f9;
  }
  .od-pay-row-meta:last-child { border-bottom: none; }
  .od-pay-method {
    font-weight: 800;
    color: #0f172a;
    font-size: 13px;
    background: #f1f5f9;
    padding: 4px 12px;
    border-radius: 8px;
    letter-spacing: 0.05em;
  }
  .od-mono {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    color: #64748b;
    background: #f1f5f9;
    padding: 3px 8px;
    border-radius: 6px;
  }

  /* Modal */
  .od-modal-bg {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(15,23,42,0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .od-modal {
    background: #fff;
    border-radius: 24px;
    padding: 32px 28px;
    width: 100%;
    max-width: 360px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.2);
  }
  .od-modal-icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, #fef2f2, #fee2e2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    margin: 0 auto 18px;
  }
  .od-modal-title { font-size: 18px; font-weight: 800; color: #0f172a; text-align: center; }
  .od-modal-sub { font-size: 14px; color: #64748b; text-align: center; margin-top: 8px; line-height: 1.6; }
  .od-modal-actions { display: flex; gap: 10px; margin-top: 24px; }
  .od-btn-ghost {
    flex: 1;
    padding: 12px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    background: #f1f5f9;
    border: none;
    color: #475569;
    cursor: pointer;
    transition: background 0.15s;
    font-family: inherit;
  }
  .od-btn-ghost:hover { background: #e2e8f0; }
  .od-btn-danger {
    flex: 1;
    padding: 12px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    border: none;
    color: #fff;
    cursor: pointer;
    transition: all 0.18s;
    box-shadow: 0 4px 12px rgba(220,38,38,0.3);
    font-family: inherit;
  }
  .od-btn-danger:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(220,38,38,0.4); }
  .od-btn-danger:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

  /* Back button */
  .od-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 0;
    margin-bottom: 2px;
    font-family: inherit;
    transition: color 0.15s;
  }
  .od-back:hover { color: #0f172a; }
  .od-back-arrow {
    font-size: 16px;
    transition: transform 0.15s;
  }
  .od-back:hover .od-back-arrow { transform: translateX(-3px); }

  /* Responsive */
  @media (max-width: 480px) {
    .od-page { padding: 14px 12px 40px; }
    .od-card-body { padding: 18px 16px 14px; }
    .od-header-content { padding: 16px 18px 14px; }
    .od-actions { padding: 10px 18px 16px; }
    .od-order-id { font-size: 18px; }
    .od-total-value { font-size: 22px; }
    .od-step-dot { width: 38px; height: 38px; font-size: 15px; }
    .od-btn-primary, .od-btn-outline, .od-btn-ghost-action { padding: 9px 14px; font-size: 12px; }
  }
`;