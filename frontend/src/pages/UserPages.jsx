import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { useStore } from "../store/useStore";
import { io } from "socket.io-client";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, CategoryScale, LinearScale, PointElement } from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement);

// ─── Màu & hằng số ───────────────────────────────────────────────────────────
const BRAND = "#ee4d2d";

// ─── Sidebar dùng chung cho các trang tài khoản ──────────────────────────────
const NAV_ITEMS = [
  { to: "/profile",       icon: "👤", label: "Tài khoản của tôi" },
  { to: "/orders",        icon: "📦", label: "Đơn hàng" },
  { to: "/wishlist",      icon: "❤️",  label: "Yêu thích" },
  { to: "/cart",          icon: "🛒", label: "Giỏ hàng" },
  { to: "/notifications", icon: "🔔", label: "Thông báo" },
  { to: "/chat",          icon: "💬", label: "Chat với Shop" },
];

function AccountSidebar({ user }) {
  const { pathname } = useLocation();
  return (
    <aside className="w-full md:w-56 shrink-0">
      {/* Avatar card */}
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-white px-4 py-4 shadow-sm">
        <img
          src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "U")}&background=ee4d2d&color=fff`}
          alt="avatar"
          className="h-11 w-11 rounded-full object-cover ring-2 ring-orange-200"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-800">{user?.name || "Người dùng"}</p>
          <Link to="/profile" className="text-xs text-gray-400 hover:text-brand">Sửa hồ sơ</Link>
        </div>
      </div>

      {/* Nav */}
      <nav className="rounded-xl bg-white shadow-sm overflow-hidden">
        {NAV_ITEMS.map(({ to, icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors border-l-[3px]
                ${active
                  ? "border-brand bg-orange-50 font-semibold text-brand"
                  : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-brand"
                }`}
            >
              <span className="text-base">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

// Layout bọc ngoài
function AccountLayout({ children, user }) {
  return (
    <div className="bg-[#f5f5f5] py-6">
      <div className="mx-auto flex max-w-6xl gap-5 px-4 md:flex-row flex-col">
        <AccountSidebar user={user} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

// Card section wrapper
function Section({ title, children, action }) {
  return (
    <div className="mb-4 rounded-xl bg-white shadow-sm overflow-hidden">
      {title && (
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold text-gray-800">{title}</h2>
          {action}
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// Input component
function Field({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>}
      <input
        className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none
                   focus:border-brand focus:ring-2 focus:ring-orange-100 transition-all"
        {...props}
      />
    </div>
  );
}

function Btn({ children, variant = "primary", className = "", ...props }) {
  const base = "inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium transition-all disabled:opacity-50";
  const variants = {
    primary: "bg-brand text-white hover:bg-orange-600 active:scale-95",
    outline: "border border-brand text-brand hover:bg-orange-50 active:scale-95",
    ghost:   "text-gray-500 hover:text-red-500 hover:bg-red-50",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props}>{children}</button>;
}

// ─── CartPage ────────────────────────────────────────────────────────────────
export function CartPage() {
  const [cart, setCart] = useState([]);
  const user = useStore((s) => s.user);
  const notify = useStore((s) => s.notify);

  const loadCart = () =>
    api.get("/cart").then((res) => {
      const items = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
      setCart(items);
    });

  useEffect(() => { loadCart(); }, []);

  const updateQty = async (item, next) => {
    if (next < 1) return;
    await api.put("/cart/update", { item_id: item.item_id, quantity: next });
    loadCart();
  };

  const removeItem = async (item) => {
    await api.delete("/cart/remove", { data: { item_id: item.item_id } });
    notify("Đã xoá sản phẩm");
    loadCart();
  };

  const total = cart.reduce((s, i) => s + (i.price - (i.price * i.discount) / 100) * i.quantity, 0);

  return (
    <AccountLayout user={user}>
      <Section title="🛒 Giỏ hàng của tôi">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-orange-50 text-4xl">🛒</div>
            <p className="text-base font-medium">Giỏ hàng đang trống</p>
            <p className="mt-1 text-sm">Hãy thêm sản phẩm vào giỏ hàng của bạn</p>
            <Link to="/products">
              <Btn className="mt-5">Tiếp tục mua sắm</Btn>
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-3 hidden grid-cols-12 gap-2 text-xs font-medium uppercase tracking-wide text-gray-400 md:grid">
              <span className="col-span-5">Sản phẩm</span>
              <span className="col-span-3 text-center">Số lượng</span>
              <span className="col-span-3 text-right">Thành tiền</span>
              <span className="col-span-1" />
            </div>

            <div className="space-y-3">
              {cart.map((item) => {
                const salePrice = item.price - (item.price * item.discount) / 100;
                return (
                  <div key={item.item_id ?? `cart-${item.product_id}`}
                    className="grid grid-cols-12 items-center gap-3 rounded-xl border border-gray-100 p-3 hover:border-orange-200 transition-colors">
                    <div className="col-span-5 flex items-center gap-3">
                      <img src={item.image ? (item.image.startsWith("http") ? item.image : `http://localhost:5000${item.image}`) : "https://placehold.co/80x80"} alt={item.name}
                        className="h-16 w-16 rounded-lg object-cover border border-gray-100" />
                      <div>
                        <p className="text-sm font-medium text-gray-800 line-clamp-2">{item.name}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{salePrice.toLocaleString()}đ / cái</p>
                      </div>
                    </div>
                    <div className="col-span-3 flex items-center justify-center gap-1">
                      <button onClick={() => updateQty(item, item.quantity - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border text-gray-500 hover:border-brand hover:text-brand transition-colors">−</button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => updateQty(item, item.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border text-gray-500 hover:border-brand hover:text-brand transition-colors">+</button>
                    </div>
                    <p className="col-span-3 text-right text-sm font-bold text-brand">
                      {(salePrice * item.quantity).toLocaleString()}đ
                    </p>
                    <button onClick={() => removeItem(item)}
                      className="col-span-1 flex justify-end text-gray-300 hover:text-red-400 transition-colors">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between rounded-xl bg-orange-50 px-5 py-4">
              <div>
                <span className="text-sm text-gray-500">Tổng cộng ({cart.length} sản phẩm)</span>
                <p className="text-2xl font-bold text-brand">{total.toLocaleString()}đ</p>
              </div>
              <Link to="/checkout">
                <Btn className="px-8 py-3 text-base">Mua hàng →</Btn>
              </Link>
            </div>
          </>
        )}
      </Section>
    </AccountLayout>
  );
}

// ─── WishlistPage ────────────────────────────────────────────────────────────
export function WishlistPage() {
  const [items, setItems] = useState([]);
  const user = useStore((s) => s.user);

  useEffect(() => {
    api.get("/wishlist").then((res) => setItems(Array.isArray(res.data) ? res.data : []));
  }, []);

  return (
    <AccountLayout user={user}>
      <Section title="❤️ Sản phẩm yêu thích">
        {items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-pink-50 text-4xl">❤️</div>
            <p className="text-base font-medium">Chưa có sản phẩm yêu thích</p>
            <Link to="/products"><Btn className="mt-5">Khám phá sản phẩm</Btn></Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {items.map((i) => (
              <Link key={i.id} to={`/products/${i.product_id || i.id}`}
                className="group rounded-xl border border-gray-100 p-3 hover:border-orange-300 hover:shadow-md transition-all">
                <img src={(() => { const u = i.thumbnail || i.image; return u ? (u.startsWith("http") ? u : `http://localhost:5000${u}`) : "https://placehold.co/200x200"; })()} alt={i.name}
                  className="mb-2 h-32 w-full rounded-lg object-cover group-hover:scale-105 transition-transform" />
                <p className="text-sm font-medium text-gray-800 line-clamp-2">{i.name}</p>
                {i.price && <p className="mt-1 text-sm font-bold text-brand">{Number(i.price).toLocaleString()}đ</p>}
              </Link>
            ))}
          </div>
        )}
      </Section>
    </AccountLayout>
  );
}

// ─── CheckoutPage ─────────────────────────────────────────────────────────────
export function CheckoutPage() {
  const notify = useStore((s) => s.notify);
  const [addresses, setAddresses] = useState([]);
  const [cart, setCart]           = useState([]);
  const [payment, setPayment]     = useState("COD");
  const [voucher, setVoucher]     = useState("");
  const [addressId, setAddressId] = useState("");
  const [placing, setPlacing]     = useState(false);
  const [newAddr, setNewAddr]     = useState({ name: "", phone: "", address: "" });
  const [showNewAddrForm, setShowNewAddrForm] = useState(false);

  const loadProfile = () =>
    api.get("/profile").then((res) => {
      const addrs = res.data.addresses ?? [];
      setAddresses(addrs);
      if (addrs.length > 0) setAddressId(String(addrs[0].id));
    });

  useEffect(() => {
    loadProfile();
    api.get("/cart").then((res) => {
      const items = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
      setCart(items);
    });
  }, []);

  const saveNewAddress = async () => {
    if (!newAddr.name || !newAddr.phone || !newAddr.address) {
      notify("Vui lòng điền đầy đủ thông tin", "error"); return;
    }
    await api.post("/addresses", { ...newAddr, is_default: addresses.length === 0 });
    await loadProfile();
    setNewAddr({ name: "", phone: "", address: "" });
    setShowNewAddrForm(false);
    notify("Đã thêm địa chỉ");
  };

  const placeOrder = async () => {
    if (!addressId) {
      if (!newAddr.name || !newAddr.phone || !newAddr.address) {
        notify("Vui lòng nhập địa chỉ nhận hàng", "error"); return;
      }
      try {
        await api.post("/addresses", { ...newAddr, is_default: true });
        await loadProfile();
      } catch { notify("Không thể lưu địa chỉ", "error"); return; }
    }
    const finalId = addressId || (await api.get("/profile").then((r) => r.data.addresses?.[0]?.id));
    if (!finalId) { notify("Không tìm thấy địa chỉ", "error"); return; }
    setPlacing(true);
    try {
      const { data } = await api.post("/orders", {
        address_id: finalId, payment_method: payment, voucher_code: voucher || undefined,
      });

      if (payment === "Mock") {
        await api.post("/payment/webhook", { orderId: data.orderId, transactionId: `MOCK-${Date.now()}` });
        notify("Đặt hàng thành công! 🎉");
        window.location.href = `/orders/${data.orderId}`;
        return;
      }

      if (payment === "MOMO") {
        const momo = await api.post("/payment/momo/create", { orderId: data.orderId });
        const payUrl = momo.data?.payUrl;
        if (!payUrl) throw new Error("Không nhận được payUrl từ MoMo");
        window.location.href = payUrl;
        return;
      }

      notify("Đặt hàng thành công! 🎉");
      window.location.href = `/orders/${data.orderId}`;
    } catch (err) {
      notify(err.response?.data?.message || "Đặt hàng thất bại", "error");
    } finally { setPlacing(false); }
  };

  const subTotal = cart.reduce((s, i) => s + (i.price - (i.price * i.discount) / 100) * i.quantity, 0);
  const shipping = subTotal > 500000 ? 0 : 30000;

  const PAYMENT_OPTS = [
    { value: "COD",    label: "💵 COD — Thanh toán khi nhận" },
    { value: "MOMO",   label: "🟣 MoMo (Sandbox)" },
    { value: "VNPay",  label: "🏦 VNPay" },
    { value: "Stripe", label: "💳 Stripe" },
    { value: "PayPal", label: "🅿️ PayPal" },
    { value: "Mock",   label: "🔧 Mock (test)" },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f5] py-6">
      <div className="mx-auto max-w-6xl px-4">
        <h1 className="mb-5 text-xl font-bold text-gray-800">Xác nhận đơn hàng</h1>
        <div className="grid gap-5 md:grid-cols-5">

          {/* Left */}
          <div className="space-y-4 md:col-span-3">

            {/* Địa chỉ */}
            <div className="rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b px-6 py-4">
                <span className="text-base">📍</span>
                <h2 className="font-semibold text-gray-800">Địa chỉ nhận hàng</h2>
              </div>
              <div className="px-6 py-5 space-y-3">
                {addresses.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {addresses.map((a) => (
                        <label key={a.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors
                            ${String(addressId) === String(a.id) ? "border-brand bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
                          <input type="radio" name="address" value={String(a.id)}
                            checked={String(addressId) === String(a.id)}
                            onChange={(e) => setAddressId(e.target.value)}
                            className="mt-0.5 accent-brand" />
                          <div>
                            <p className="text-sm font-medium">{a.name} · {a.phone}</p>
                            <p className="text-xs text-gray-500">{a.address}{a.city ? `, ${a.city}` : ""}</p>
                            {a.is_default && <span className="mt-1 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs text-brand">Mặc định</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                    <button onClick={() => setShowNewAddrForm(v => !v)}
                      className="text-xs font-medium text-brand hover:underline">
                      {showNewAddrForm ? "▲ Ẩn" : "+ Thêm địa chỉ mới"}
                    </button>
                  </>
                ) : (
                  <p className="mb-2 text-xs text-orange-500 font-medium">⚠️ Bạn chưa có địa chỉ — vui lòng nhập bên dưới</p>
                )}

                {(addresses.length === 0 || showNewAddrForm) && (
                  <div className="grid gap-3 rounded-xl bg-gray-50 p-4 md:grid-cols-2">
                    <Field label="Họ tên *" placeholder="Nguyễn Văn A"
                      value={newAddr.name} onChange={(e) => setNewAddr(s => ({ ...s, name: e.target.value }))} />
                    <Field label="Số điện thoại *" placeholder="0901234567"
                      value={newAddr.phone} onChange={(e) => setNewAddr(s => ({ ...s, phone: e.target.value }))} />
                    <div className="md:col-span-2">
                      <Field label="Địa chỉ *" placeholder="123 Nguyễn Huệ, Q.1, TP.HCM"
                        value={newAddr.address} onChange={(e) => setNewAddr(s => ({ ...s, address: e.target.value }))} />
                    </div>
                    {addresses.length > 0 && (
                      <Btn onClick={saveNewAddress} className="md:col-span-2">Lưu địa chỉ</Btn>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Voucher */}
            <div className="rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b px-6 py-4">
                <span>🎟️</span>
                <h2 className="font-semibold text-gray-800">Mã giảm giá</h2>
              </div>
              <div className="flex gap-2 px-6 py-5">
                <input className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-orange-100"
                  value={voucher} onChange={(e) => setVoucher(e.target.value)} placeholder="Nhập mã voucher..." />
                <Btn variant="outline">Áp dụng</Btn>
              </div>
            </div>

            {/* Thanh toán */}
            <div className="rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b px-6 py-4">
                <span>💳</span>
                <h2 className="font-semibold text-gray-800">Phương thức thanh toán</h2>
              </div>
              <div className="grid gap-2 px-6 py-5 md:grid-cols-2">
                {PAYMENT_OPTS.map(opt => (
                  <label key={opt.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors
                      ${payment === opt.value ? "border-brand bg-orange-50 font-medium text-brand" : "border-gray-200 hover:border-gray-300"}`}>
                    <input type="radio" name="payment" value={opt.value} checked={payment === opt.value}
                      onChange={(e) => setPayment(e.target.value)} className="accent-brand" />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right — tổng kết */}
          <div className="md:col-span-2">
            <div className="sticky top-4 rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="border-b px-6 py-4 font-semibold text-gray-800">🧾 Tổng kết đơn hàng</div>
              <div className="px-6 py-5">
                <div className="max-h-60 overflow-auto space-y-3 pr-1">
                  {cart.map((item) => {
                    const sp = item.price - (item.price * item.discount) / 100;
                    return (
                      <div key={item.id ?? item.product_id} className="flex gap-2">
                        <img src={item.image ? (item.image.startsWith("http") ? item.image : `http://localhost:5000${item.image}`) : "https://placehold.co/48x48"} alt={item.name}
                          className="h-12 w-12 rounded-lg object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs font-medium text-gray-700">{item.name}</p>
                          <p className="text-xs text-gray-400">x{item.quantity}</p>
                        </div>
                        <p className="text-xs font-bold text-brand shrink-0">{(sp * item.quantity).toLocaleString()}đ</p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 space-y-2 border-t pt-4 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Tạm tính</span>
                    <span>{subTotal.toLocaleString()}đ</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Phí ship</span>
                    {shipping === 0
                      ? <span className="text-green-500 font-medium">Miễn phí ✓</span>
                      : <span>{shipping.toLocaleString()}đ</span>}
                  </div>
                  <div className="flex justify-between border-t pt-3 font-bold">
                    <span className="text-gray-800">Tổng thanh toán</span>
                    <span className="text-xl text-brand">{(subTotal + shipping).toLocaleString()}đ</span>
                  </div>
                </div>

                <Btn onClick={placeOrder} disabled={placing} className="mt-5 w-full py-3 text-base">
                  {placing ? "Đang xử lý..." : "Đặt hàng ngay"}
                </Btn>

                {subTotal > 0 && subTotal <= 500000 && (
                  <p className="mt-3 text-center text-xs text-gray-400">
                    Mua thêm <span className="font-medium text-brand">{(500000 - subTotal).toLocaleString()}đ</span> để miễn phí ship
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ReviewModal ─────────────────────────────────────────────────────────────
function ReviewModal({ order, onClose, onDone }) {
  const notify = useStore((s) => s.notify);
  const [items, setItems] = useState([]);
  // reviewedIds: set of product_id đã review xong trong session này
  const [reviewedIds, setReviewedIds] = useState(new Set());
  const [forms, setForms] = useState({}); // { [product_id]: { rating, comment, image } }
  const [submitting, setSubmitting] = useState(null); // product_id đang submit

  // Lấy danh sách sản phẩm trong đơn
  useEffect(() => {
    api.get(`/orders/${order.id}`)
      .then((res) => {
        const detail = res.data;
        const products = detail.items ?? detail.products ?? detail.order_items ?? [];
        setItems(products);
        // Init form cho từng sản phẩm
        const init = {};
        products.forEach((p) => {
          const pid = p.product_id ?? p.id;
          init[pid] = { rating: 5, comment: "", image: null };
        });
        setForms(init);
      })
      .catch(() => notify("Không thể tải sản phẩm", "error"));
  }, [order.id]);

  const setForm = (pid, field, value) =>
    setForms((prev) => ({ ...prev, [pid]: { ...prev[pid], [field]: value } }));

  const submitOne = async (pid) => {
    const f = forms[pid];
    if (!f?.comment?.trim()) { notify("Vui lòng nhập nhận xét", "error"); return; }
    setSubmitting(pid);
    try {
      const form = new FormData();
      form.append("product_id", String(pid));
      form.append("rating", String(f.rating));
      form.append("comment", f.comment);
      if (f.image) form.append("image", f.image);
      await api.post("/reviews", form, { headers: { "Content-Type": "multipart/form-data" } });
      setReviewedIds((prev) => new Set([...prev, pid]));
      notify("Đánh giá thành công ⭐");
    } catch (err) {
      notify(err.response?.data?.message || "Gửi thất bại", "error");
    } finally {
      setSubmitting(null);
    }
  };

  const allDone = items.length > 0 && items.every((p) => reviewedIds.has(p.product_id ?? p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <div>
            <h2 className="font-bold text-gray-800">⭐ Đánh giá đơn hàng #{order.id}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Chia sẻ trải nghiệm của bạn về sản phẩm</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {items.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand border-t-transparent" />
            </div>
          ) : items.map((p) => {
            const pid = p.product_id ?? p.id;
            const f = forms[pid] || { rating: 5, comment: "", image: null };
            const done = reviewedIds.has(pid);
            const imgSrc = p.image || p.thumbnail;
            const imgUrl = imgSrc ? (imgSrc.startsWith("http") ? imgSrc : `http://localhost:5000${imgSrc}`) : "https://placehold.co/56x56";

            return (
              <div key={pid} className={`rounded-xl border p-4 transition-all ${done ? "border-green-200 bg-green-50" : "border-gray-200"}`}>
                {/* Product info */}
                <div className="flex items-center gap-3 mb-4">
                  <img src={imgUrl} alt={p.name} className="h-14 w-14 rounded-lg object-cover border border-gray-100 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 line-clamp-2">{p.name || p.product_name}</p>
                    {done && <p className="mt-1 text-xs text-green-600 font-medium">✓ Đã đánh giá</p>}
                  </div>
                </div>

                {done ? (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <svg key={i} className={`h-5 w-5 ${i < (forms[pid]?.rating || 5) ? "text-amber-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                    <span className="ml-1 text-xs text-gray-500">"{forms[pid]?.comment}"</span>
                  </div>
                ) : (
                  <>
                    {/* Star picker */}
                    <div className="mb-3">
                      <p className="mb-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Số sao</p>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} onClick={() => setForm(pid, "rating", star)}
                            className="transition-transform hover:scale-110">
                            <svg className={`h-7 w-7 ${star <= f.rating ? "text-amber-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </button>
                        ))}
                        <span className="ml-2 text-sm font-semibold text-amber-500">{f.rating}/5</span>
                      </div>
                    </div>

                    {/* Comment */}
                    <textarea
                      rows={3}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-orange-100 transition-all resize-none"
                      placeholder="Chia sẻ cảm nhận của bạn về sản phẩm..."
                      value={f.comment}
                      onChange={(e) => setForm(pid, "comment", e.target.value)}
                    />

                    {/* Image + Submit row */}
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:border-brand hover:text-brand transition-colors">
                        🖼️ {f.image ? f.image.name : "Thêm ảnh"}
                        <input type="file" accept="image/*" className="hidden"
                          onChange={(e) => setForm(pid, "image", e.target.files?.[0] || null)} />
                      </label>
                      <Btn onClick={() => submitOne(pid)} disabled={submitting === pid} className="shrink-0 px-4 py-2 text-xs">
                        {submitting === pid ? "Đang gửi..." : "Gửi đánh giá"}
                      </Btn>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 shrink-0">
          {allDone ? (
            <Btn onClick={() => { onDone(); onClose(); }} className="w-full py-3">
              ✓ Hoàn tất đánh giá
            </Btn>
          ) : (
            <button onClick={onClose} className="w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              Để sau
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── OrderHistoryPage ─────────────────────────────────────────────────────────
export function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("all");
  const [reviewOrder, setReviewOrder] = useState(null); // order đang mở modal
  const user = useStore((s) => s.user);
  const { key } = useLocation(); // key thay đổi mỗi khi navigate tới trang này

  const loadOrders = () =>
    api.get("/orders/my").then((res) => setOrders(Array.isArray(res.data) ? res.data : []));

  useEffect(() => { loadOrders(); }, [key]); // re-fetch mỗi khi quay lại trang

  const STATUS = {
    placed:    { label: "Đã đặt",      color: "bg-blue-100 text-blue-600",    icon: "📋" },
    confirmed: { label: "Đã xác nhận", color: "bg-yellow-100 text-yellow-600", icon: "✅" },
    shipping:  { label: "Đang giao",   color: "bg-orange-100 text-orange-600", icon: "🚚" },
    delivered: { label: "Đã nhận",     color: "bg-green-100 text-green-600",   icon: "📦" },
    cancelled: { label: "Đã huỷ",      color: "bg-gray-100 text-gray-500",     icon: "❌" },
  };
  const TABS = [
    { key: "all",       label: "Tất cả" },
    { key: "pending",   label: "Chờ xác nhận" },
    { key: "shipping",  label: "Đang giao" },
    { key: "delivered", label: "Đã nhận" },
    { key: "cancelled", label: "Đã huỷ" },
  ];

  const filtered = tab === "all"
    ? orders
    : tab === "pending"
      ? orders.filter(o => o.status === "placed" || o.status === "confirmed")
      : orders.filter(o => o.status === tab);

  return (
    <AccountLayout user={user}>
      {/* Tab bar */}
      <div className="mb-4 flex overflow-x-auto rounded-xl bg-white shadow-sm">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors
              ${tab === t.key ? "border-brand text-brand" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl bg-white py-16 shadow-sm text-gray-400">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-50 text-4xl">📦</div>
          <p className="font-medium">Chưa có đơn hàng nào</p>
          <Link to="/products"><Btn className="mt-5">Mua sắm ngay</Btn></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const s = STATUS[o.status] || STATUS.placed;
            const canReview = o.status === "delivered" && !o.is_reviewed;
            return (
              <div key={o.id} className="rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                {/* Header row — click vào đây để xem chi tiết */}
                <Link to={`/orders/${o.id}`} className="block">
                  <div className="flex items-center justify-between border-b border-dashed px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">#{o.id}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-400">
                        {o.created_at ? new Date(o.created_at).toLocaleDateString("vi-VN") : ""}
                      </span>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${s.color}`}>
                      {s.icon} {s.label}
                    </span>
                  </div>
                </Link>

                {/* Body row */}
                <div className="flex items-center justify-between px-5 py-4 gap-3">
                  <div>
                    <p className="text-sm text-gray-500">
                      Phương thức: <span className="font-medium text-gray-700">{o.payment_method || "—"}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Tổng cộng</p>
                      <p className="text-lg font-bold text-brand">{Number(o.total_price).toLocaleString()}đ</p>
                    </div>
                    {/* Nút đánh giá — chỉ hiện khi đã nhận hàng và chưa đánh giá */}
                    {canReview && (
                      <button
                        onClick={() => setReviewOrder(o)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 active:scale-95 transition-all"
                      >
                        ⭐ Đánh giá
                      </button>
                    )}
                    {o.status === "delivered" && o.is_reviewed && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-green-100 px-3 py-2 text-xs font-medium text-green-600">
                        ✓ Đã đánh giá
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {reviewOrder && (
        <ReviewModal
          order={reviewOrder}
          onClose={() => setReviewOrder(null)}
          onDone={() => {
            // Đánh dấu đơn đã review trong local state (không cần refetch)
            setOrders((prev) =>
              prev.map((o) => o.id === reviewOrder.id ? { ...o, is_reviewed: true } : o)
            );
          }}
        />
      )}
    </AccountLayout>
  );
}

// ─── ProfilePage ──────────────────────────────────────────────────────────────
export function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: "", email: "", avatar: null });
  const [passwordForm, setPasswordForm] = useState({ oldPassword: "", newPassword: "" });
  const [addressForm, setAddressForm] = useState({ name: "", phone: "", address: "", is_default: false });
  const [saving, setSaving] = useState(false);
  const notify = useStore((s) => s.notify);
  const user = useStore((s) => s.user);

  const load = () =>
    api.get("/profile").then((res) => {
      setProfile(res.data);
      setProfileForm(prev => ({ ...prev, name: res.data.user?.name ?? "", email: res.data.user?.email ?? "" }));
    });

  useEffect(() => { load(); }, []);

  if (!profile) return (
    <AccountLayout user={user}>
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    </AccountLayout>
  );

  const saveProfile = async () => {
    setSaving(true);
    try {
      const form = new FormData();
      form.append("name", profileForm.name);
      form.append("email", profileForm.email);
      if (profileForm.avatar) form.append("avatar", profileForm.avatar);
      await api.put("/profile", form, { headers: { "Content-Type": "multipart/form-data" } });
      notify("Cập nhật thành công ✓");
      load();
    } catch { notify("Cập nhật thất bại", "error"); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    try {
      await api.put("/profile/password", passwordForm);
      setPasswordForm({ oldPassword: "", newPassword: "" });
      notify("Đổi mật khẩu thành công ✓");
    } catch (err) { notify(err.response?.data?.message || "Thất bại", "error"); }
  };

  const addAddress = async () => {
    try {
      await api.post("/addresses", addressForm);
      setAddressForm({ name: "", phone: "", address: "", is_default: false });
      notify("Đã thêm địa chỉ ✓");
      load();
    } catch { notify("Thêm địa chỉ thất bại", "error"); }
  };

  const removeAddress = async (id) => {
    await api.delete(`/addresses/${id}`);
    notify("Đã xoá địa chỉ");
    load();
  };

  return (
    <AccountLayout user={profile.user}>
      {/* Thông tin cá nhân */}
      <Section title="Thông tin cá nhân"
        action={<Btn onClick={saveProfile} disabled={saving}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</Btn>}>
        <div className="flex flex-col gap-5 md:flex-row">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <img
              src={profile.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.user?.name || "U")}&background=ee4d2d&color=fff&size=120`}
              alt="avatar"
              className="h-24 w-24 rounded-full object-cover ring-4 ring-orange-100"
            />
            <label className="cursor-pointer rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:border-brand hover:text-brand transition-colors">
              Đổi ảnh
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => setProfileForm(s => ({ ...s, avatar: e.target.files?.[0] || null }))} />
            </label>
          </div>

          {/* Fields */}
          <div className="flex-1 grid gap-4 md:grid-cols-2">
            <Field label="Họ và tên" value={profileForm.name}
              onChange={(e) => setProfileForm(s => ({ ...s, name: e.target.value }))} placeholder="Nguyễn Văn A" />
            <Field label="Email" type="email" value={profileForm.email}
              onChange={(e) => setProfileForm(s => ({ ...s, email: e.target.value }))} placeholder="email@example.com" />
          </div>
        </div>
      </Section>

      {/* Đổi mật khẩu */}
      <Section title="Bảo mật — Đổi mật khẩu">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Mật khẩu hiện tại" type="password" value={passwordForm.oldPassword}
            onChange={(e) => setPasswordForm(s => ({ ...s, oldPassword: e.target.value }))} placeholder="••••••••" />
          <Field label="Mật khẩu mới" type="password" value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm(s => ({ ...s, newPassword: e.target.value }))} placeholder="••••••••" />
          <Btn onClick={changePassword} variant="outline" className="md:col-span-2">Cập nhật mật khẩu</Btn>
        </div>
      </Section>

      {/* Địa chỉ */}
      <Section title="Địa chỉ giao hàng">
        {/* Danh sách */}
        {(profile.addresses ?? []).length > 0 && (
          <div className="mb-5 space-y-2">
            {(profile.addresses ?? []).map((a) => (
              <div key={a.id} className="flex items-start justify-between rounded-xl border border-gray-200 p-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">{a.name} · {a.phone}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.address}{a.city ? `, ${a.city}` : ""}</p>
                  {a.is_default && (
                    <span className="mt-1.5 inline-block rounded-full border border-brand px-2 py-0.5 text-xs text-brand">Mặc định</span>
                  )}
                </div>
                <Btn variant="ghost" onClick={() => removeAddress(a.id)} className="text-xs">Xoá</Btn>
              </div>
            ))}
          </div>
        )}

        {/* Thêm mới */}
        <div className="rounded-xl bg-gray-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Thêm địa chỉ mới</p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Tên người nhận" value={addressForm.name}
              onChange={(e) => setAddressForm(s => ({ ...s, name: e.target.value }))} placeholder="Nguyễn Văn A" />
            <Field label="Số điện thoại" value={addressForm.phone}
              onChange={(e) => setAddressForm(s => ({ ...s, phone: e.target.value }))} placeholder="0901234567" />
            <div className="md:col-span-2">
              <Field label="Địa chỉ" value={addressForm.address}
                onChange={(e) => setAddressForm(s => ({ ...s, address: e.target.value }))} placeholder="123 Đường ABC, Quận 1, TP.HCM" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={addressForm.is_default} className="accent-brand"
                onChange={(e) => setAddressForm(s => ({ ...s, is_default: e.target.checked }))} />
              Đặt làm địa chỉ mặc định
            </label>
            <Btn onClick={addAddress} className="md:col-span-2">+ Thêm địa chỉ</Btn>
          </div>
        </div>
      </Section>
    </AccountLayout>
  );
}

// ─── NotificationPage ─────────────────────────────────────────────────────────
export function NotificationPage() {
  const [notis, setNotis] = useState([]);
  const user = useStore((s) => s.user);

  const load = () => api.get("/notifications").then((res) => {
    // Backend giờ trả về array trực tiếp
    const list = Array.isArray(res.data) ? res.data : (res.data?.notifications ?? []);
    setNotis(list);
  });
  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await Promise.all(notis.filter(n => !n.is_read).map(n => api.put("/notifications/read", { id: n.id })));
    load();
  };

  return (
    <AccountLayout user={user}>
      <Section title="🔔 Thông báo"
        action={notis.some(n => !n.is_read) && (
          <button onClick={markAll} className="text-xs text-brand hover:underline">Đánh dấu tất cả đã đọc</button>
        )}>
        {notis.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-3xl">🔔</div>
            <p>Không có thông báo nào</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notis.map((n) => (
              <button key={n.id} onClick={async () => { await api.put("/notifications/read", { id: n.id }); load(); }}
                className={`w-full rounded-xl border p-4 text-left transition-all hover:shadow-sm
                  ${n.is_read ? "border-gray-100 opacity-60" : "border-orange-200 bg-orange-50"}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${n.is_read ? "bg-gray-300" : "bg-brand"}`} />
                  <div>
                    <p className={`text-sm font-medium ${n.is_read ? "text-gray-600" : "text-gray-800"}`}>{n.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{n.message}</p>
                    {n.created_at && <p className="mt-1 text-xs text-gray-400">{new Date(n.created_at).toLocaleString("vi-VN")}</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Section>
    </AccountLayout>
  );
}

// ─── AdminDashboardPage ───────────────────────────────────────────────────────
export function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    api.get("/admin/stats").then((res) => setStats(res.data));
    api.get("/admin/revenue?mode=day").then((res) => setRevenue(Array.isArray(res.data) ? res.data : []));
    api.get("/admin/users").then((res) => setUsers(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    api.get("/admin/orders").then((res) => setOrders(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    api.get("/admin/vouchers").then((res) => setVouchers(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    api.get("/admin/payments").then((res) => setPayments(Array.isArray(res.data) ? res.data : [])).catch(() => {});
  }, []);

  if (!stats) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4">
      <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Người dùng", value: stats.totalUsers,    icon: "👥", color: "bg-blue-50 text-blue-600" },
          { label: "Đơn hàng",   value: stats.totalOrders,   icon: "📦", color: "bg-orange-50 text-orange-600" },
          { label: "Sản phẩm",   value: stats.totalProducts, icon: "🛍️", color: "bg-purple-50 text-purple-600" },
          { label: "Doanh thu",  value: `${Number(stats.totalRevenue).toLocaleString()}đ`, icon: "💰", color: "bg-green-50 text-green-600" },
        ].map(c => (
          <div key={c.label} className="rounded-xl bg-white p-5 shadow-sm">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl text-xl ${c.color}`}>{c.icon}</div>
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className="text-2xl font-bold text-gray-800">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-700">📈 Doanh thu theo ngày</h2>
        <Line data={{
          labels: revenue.map((r) => r.period),
          datasets: [{ label: "Doanh thu", data: revenue.map((r) => r.revenue), borderColor: BRAND, tension: 0.4, pointBackgroundColor: BRAND }],
        }} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
      </div>

      {(stats.lowStock ?? []).length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-orange-600">⚠️ Sắp hết hàng</h2>
          <div className="space-y-2">
            {stats.lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-orange-50 px-4 py-2 text-sm">
                <span className="font-medium text-gray-700">{p.name}</span>
                <span className="font-bold text-orange-600">{p.stock} còn lại</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { title: "👥 Người dùng", items: users.slice(0, 6).map(u => `${u.name} — ${u.role}${u.is_blocked ? " 🔒" : ""}`) },
          { title: "🎟️ Voucher",    items: vouchers.slice(0, 6).map(v => `${v.code} — ${v.discount_percent}%`) },
          { title: "📦 Đơn hàng",   items: orders.slice(0, 6).map(o => `#${o.id} — ${o.status}`) },
          { title: "💳 Thanh toán", items: payments.slice(0, 6).map(p => `#${p.id} — ${p.payment_method} — ${p.payment_status}`) },
        ].map(sec => (
          <div key={sec.title} className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-gray-700">{sec.title}</h2>
            <div className="space-y-1.5">
              {sec.items.map((item, i) => (
                <div key={i} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">{item}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ChatPage ─────────────────────────────────────────────────────────────────
export function ChatPage() {
  const user = useStore((s) => s.user);
  const notify = useStore((s) => s.notify);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const containerRef = useRef(null); // ref cho messages container
  // Dùng ref để tránh race condition với socket
  const messagesRef = useRef([]);
  const isFirstLoad = useRef(true); // chặn scroll khi load lần đầu

  const setMsgs = (data) => {
    const arr = Array.isArray(data) ? data : [];
    messagesRef.current = arr;
    setMessages(arr);
  };

  // Load lịch sử chat
  useEffect(() => {
    api.get("/chat/my-thread")
      .then((res) => setMsgs(res.data))
      .catch(() => {});
  }, []);

  // Kết nối socket
  useEffect(() => {
    if (!user?.id) return;
    const s = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000");
    setSocket(s);
    s.emit("join_user_room", user.id);

    s.on("chat:new", (msg) => {
      // Chỉ append nếu tin này chưa có trong danh sách (tránh duplicate)
      setMessages((prev) => {
        const exists = prev.some(
          (m) => (m.id && m.id === msg.id) ||
                 (String(m.id).startsWith("tmp-") && m.message === msg.message && m.sender_id === msg.sender_id)
        );
        if (exists) {
          // Thay thế tin optimistic bằng tin thật từ server
          return prev.map((m) =>
            String(m.id).startsWith("tmp-") && m.message === msg.message ? msg : m
          );
        }
        return [...prev, msg];
      });
    });

    return () => s.disconnect();
  }, [user?.id]);

  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      // Khi load lịch sử lần đầu: scroll container lên TOP, không xuống cuối
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
      return;
    }
    // Chỉ scroll xuống cuối khi có tin mới (gửi/nhận)
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    // Tạo tin optimistic để hiển thị ngay
    const tmpId = `tmp-${Date.now()}`;
    const optimistic = {
      id: tmpId,
      sender_id: user?.id,
      message: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setSending(true);

    try {
      await api.post("/chat/user-send", { message: trimmed });
      // Sau khi API thành công, fetch lại để đồng bộ id thật từ DB
      // và thay thế tin optimistic
      const res = await api.get("/chat/my-thread");
      setMsgs(res.data);
    } catch (err) {
      // Nếu lỗi: xóa tin optimistic và thông báo
      setMessages((prev) => prev.filter((m) => m.id !== tmpId));
      notify(err?.response?.data?.message || "Gửi tin nhắn thất bại", "error");
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <AccountLayout user={user}>
      <div className="flex h-[calc(100vh-160px)] min-h-[500px] flex-col rounded-xl bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-lg">🏪</div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Hỗ trợ khách hàng</p>
            <p className="text-xs text-green-500">● Online</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={containerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-400">
              <div className="mb-3 text-5xl">💬</div>
              <p className="text-sm">Chưa có tin nhắn. Hãy gửi câu hỏi đầu tiên!</p>
            </div>
          ) : (
            messages.map((m, idx) => {
              // So sánh cả string lẫn number để chắc chắn
              const isMine = Number(m.sender_id) === Number(user?.id);
              const isOptimistic = String(m.id).startsWith("tmp-");
              return (
                <div key={m.id ?? `msg-${idx}`} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  {!isMine && (
                    <div className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm">🏪</div>
                  )}
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-opacity
                    ${isOptimistic ? "opacity-60" : "opacity-100"}
                    ${isMine
                      ? "rounded-br-sm bg-brand text-white"
                      : "rounded-bl-sm bg-gray-100 text-gray-800"}`}>
                    <p>{m.message}</p>
                    <p className={`mt-1 text-right text-[10px] ${isMine ? "text-orange-200" : "text-gray-400"}`}>
                      {m.created_at
                        ? new Date(m.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                        : "..."}
                      {isOptimistic && " ·  đang gửi"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3">
          <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2">
            <input
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Nhập tin nhắn... (Enter để gửi)"
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white transition-all hover:bg-orange-600 disabled:opacity-40 active:scale-95"
            >
              {sending ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}