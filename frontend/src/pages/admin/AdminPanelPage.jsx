import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import api from "../../services/api";
import { formatPrice } from "../../utils/format";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";

// ─── Hằng số ───────────────────────────────────────────────────────────────
const TRANG_THAI_DON = ["placed", "confirmed", "shipping", "delivered", "cancelled"];
const TRANG_THAI_VI = {
  placed: "Đã đặt",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
};

const MENU = [
  { key: "dashboard",    icon: "📊", label: "Tổng quan" },
  { key: "products",     icon: "📦", label: "Sản phẩm" },
  { key: "categories",   icon: "🗂️",  label: "Danh mục" },
  { key: "orders",       icon: "📑", label: "Đơn hàng" },
  { key: "users",        icon: "👥", label: "Người dùng" },
  { key: "payments",     icon: "💰", label: "Thanh toán" },
  { key: "vouchers",     icon: "🎟️",  label: "Voucher" },
  { key: "flash_sales",  icon: "⚡", label: "Flash Sale" },
  { key: "notifications",icon: "🔔", label: "Thông báo" },
  { key: "chat",         icon: "💬", label: "Chat" },
];

// ─── Utilities ──────────────────────────────────────────────────────────────
function Countdown({ endTime }) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endTime) - new Date();
      if (diff <= 0) { setTimeLeft("Đã kết thúc"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [endTime]);
  return <span className="font-mono text-orange-600 font-bold">{timeLeft}</span>;
}

function Badge({ color, children }) {
  const colors = {
    green:  "bg-green-100 text-green-700",
    red:    "bg-red-100 text-red-600",
    yellow: "bg-yellow-100 text-yellow-700",
    blue:   "bg-blue-100 text-blue-700",
    gray:   "bg-gray-100 text-gray-600",
    orange: "bg-orange-100 text-orange-700",
    rose:   "bg-rose-100 text-rose-600",
    indigo: "bg-indigo-100 text-indigo-700",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[color] || colors.gray}`}>{children}</span>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color = "indigo", trend }) {
  const colors = {
    indigo: { bg: "bg-indigo-500", light: "bg-indigo-50", text: "text-indigo-600" },
    green:  { bg: "bg-emerald-500", light: "bg-emerald-50", text: "text-emerald-600" },
    orange: { bg: "bg-orange-500", light: "bg-orange-50", text: "text-orange-600" },
    rose:   { bg: "bg-rose-500", light: "bg-rose-50", text: "text-rose-600" },
  };
  const c = colors[color];
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{label}</p>
          <p className="text-3xl font-black text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
          {trend !== undefined && (
            <div className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              <span>{trend >= 0 ? "↑" : "↓"}</span>
              <span>{Math.abs(trend)}% so với hôm qua</span>
            </div>
          )}
        </div>
        <div className={`${c.light} rounded-2xl p-3 text-2xl`}>{icon}</div>
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>}
      <input className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all" {...props} />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>}
      <select className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all" {...props}>
        {children}
      </select>
    </div>
  );
}

function Btn({ variant = "primary", className = "", ...props }) {
  const base = "rounded-xl px-4 py-2 text-sm font-medium transition-all active:scale-95 disabled:opacity-50";
  const variants = {
    primary:  "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
    danger:   "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
    ghost:    "bg-gray-100 text-gray-700 hover:bg-gray-200",
    orange:   "bg-orange-500 text-white hover:bg-orange-600 shadow-sm",
    success:  "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

function EmptyState({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-300">
      <span className="text-5xl mb-3">{icon}</span>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}

// ─── Custom Tooltip cho recharts ────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-gray-900 px-3 py-2 shadow-xl border border-gray-700">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-white">
        {Number(payload[0].value).toLocaleString("vi-VN")}đ
      </p>
    </div>
  );
}

// ─── Phần Dashboard ─────────────────────────────────────────────────────────
function Dashboard({ stats, products, broadcast, setBroadcast, sendBroadcast, onRefresh }) {
  const lowStock = products.filter((p) => p.stock < 10);
  const [period, setPeriod] = useState("Ngày");
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const periodMap = { "Ngày": "day", "Tháng": "month", "Năm": "year" };

  const loadChart = useCallback(async (p) => {
    setPeriod(p);
    setChartLoading(true);
    try {
      const res = await api.get(`/admin/revenue?mode=${periodMap[p]}`);
      const raw = Array.isArray(res.data) ? res.data : (res.data?.revenueChart || []);
      setChartData(raw);
      setLastRefresh(new Date());
    } catch {
      setChartData(stats?.revenueChart || []);
    } finally {
      setChartLoading(false);
    }
  }, [stats]);

  // Load chart lần đầu
  useEffect(() => { loadChart("Ngày"); }, []);

  // Auto-refresh biểu đồ mỗi 30 giây
  useEffect(() => {
    const t = setInterval(() => loadChart(period), 30000);
    return () => clearInterval(t);
  }, [period, loadChart]);

  const fmtAxis = (v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : String(v);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="👤" label="Tổng người dùng" value={stats?.totalUsers ?? "—"} color="indigo" />
        <StatCard icon="📑" label="Tổng đơn hàng"   value={stats?.totalOrders ?? "—"} color="green" />
        <StatCard icon="📦" label="Tổng sản phẩm"   value={stats?.totalProducts ?? "—"} color="orange" />
        <StatCard icon="💰" label="Doanh thu" value={stats ? formatPrice(stats.totalRevenue) : "—"} color="rose" />
      </div>

      {/* Biểu đồ doanh thu + Top sản phẩm */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Biểu đồ recharts */}
        <div className="lg:col-span-2 rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-gray-800">📈 Doanh thu</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Cập nhật lúc {lastRefresh.toLocaleTimeString("vi-VN")} · tự động làm mới 30s
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {["Ngày", "Tháng", "Năm"].map((t) => (
                  <button
                    key={t}
                    onClick={() => loadChart(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      period === t
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                onClick={() => loadChart(period)}
                className="rounded-xl border border-gray-200 p-1.5 hover:bg-gray-50 transition-colors"
                title="Làm mới"
              >
                <span className={`text-sm block ${chartLoading ? "animate-spin" : ""}`}>🔄</span>
              </button>
            </div>
          </div>

          {chartLoading ? (
            <div className="h-56 flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 rounded-full border-3 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-xs text-gray-400">Đang tải dữ liệu...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-gray-300">
              <span className="text-4xl mb-2">📊</span>
              <p className="text-sm text-gray-400">Chưa có dữ liệu doanh thu</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={fmtAxis}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#colorRev)"
                  dot={chartData.length <= 15 ? { r: 3, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" } : false}
                  activeDot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top sản phẩm */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">🏆 Sản phẩm bán chạy</h3>
          {stats?.topProducts?.length ? (
            <div className="space-y-3">
              {stats.topProducts.slice(0, 5).map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    i === 0 ? "bg-yellow-400 text-white" :
                    i === 1 ? "bg-gray-300 text-white" :
                    i === 2 ? "bg-orange-300 text-white" : "bg-gray-100 text-gray-500"
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{p.name}</p>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all"
                        style={{ width: `${Math.min(100, (p.sold / (stats.topProducts[0]?.sold || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-500 shrink-0">{p.sold} bán</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="📦" text="Chưa có dữ liệu" />
          )}

          {/* Bar chart nhỏ cho top products */}
          {stats?.topProducts?.length > 0 && (
            <div className="mt-5">
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={stats.topProducts.slice(0, 5)} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v.length > 8 ? v.slice(0, 8) + "…" : v} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => [`${v} đã bán`, ""]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="sold" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Cảnh báo tồn kho thấp */}
      {lowStock.length > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4">
          <h3 className="font-semibold text-orange-700 mb-2">⚠️ Tồn kho thấp ({lowStock.length} sản phẩm)</h3>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((p) => (
              <span key={p.id} className="rounded-xl border border-orange-200 bg-white px-3 py-1 text-xs text-orange-700 shadow-sm">
                {p.name} — <strong>{p.stock}</strong> còn lại
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Broadcast */}
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4">🔔 Gửi thông báo toàn hệ thống</h3>
        <form onSubmit={sendBroadcast} className="grid gap-3 md:grid-cols-3">
          <Input label="Tiêu đề" placeholder="Nhập tiêu đề thông báo" value={broadcast.title} onChange={(e) => setBroadcast((s) => ({ ...s, title: e.target.value }))} />
          <div className="md:col-span-2">
            <Input label="Nội dung" placeholder="Nội dung thông báo..." value={broadcast.message} onChange={(e) => setBroadcast((s) => ({ ...s, message: e.target.value }))} />
          </div>
          <Btn type="submit" variant="primary" className="md:col-span-3 w-full">Gửi thông báo</Btn>
        </form>
      </div>
    </div>
  );
}

// ─── Sản phẩm ───────────────────────────────────────────────────────────────
function Products({ products, categories, loadAll }) {
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);
  const [form, setForm] = useState({ name: "", price: "", stock: "", category_id: "", brand: "", discount: 0, description: "" });
  const [images, setImages] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editImages, setEditImages] = useState([]);

  const create = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
    for (const f of images) fd.append("images", f);
    await api.post("/admin/products", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setForm({ name: "", price: "", stock: "", category_id: "", brand: "", discount: 0, description: "" });
    setImages([]);
    await loadAll();
  };

  const save = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(editing).forEach(([k, v]) => fd.append(k, String(v ?? "")));
    for (const f of editImages) fd.append("images", f);
    await api.put(`/admin/products/${editing.id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    setEditing(null);
    setEditImages([]);
    await loadAll();
  };

  const F = ({ field, ...props }) => (
    <Input {...props} value={form[field]} onChange={(e) => setForm((s) => ({ ...s, [field]: e.target.value }))} />
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4">➕ Tạo sản phẩm mới</h3>
        <form onSubmit={create} className="grid gap-3 md:grid-cols-3">
          <F field="name" label="Tên sản phẩm" placeholder="Nhập tên..." />
          <F field="price" label="Giá (VNĐ)" placeholder="0" type="number" />
          <F field="stock" label="Tồn kho" placeholder="0" type="number" />
          <F field="brand" label="Thương hiệu" placeholder="Apple, Samsung..." />
          <F field="discount" label="Giảm giá (%)" placeholder="0" type="number" />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Danh mục</label>
            <select className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-indigo-400" value={form.category_id} onChange={(e) => setForm((s) => ({ ...s, category_id: e.target.value }))}>
              <option value="">-- Chọn danh mục --</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">Mô tả</label>
            <textarea className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-indigo-400 h-20 resize-none" placeholder="Mô tả sản phẩm..." value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">Ảnh sản phẩm</label>
            <input type="file" multiple accept="image/*" className="w-full text-sm text-gray-500 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-600" onChange={(e) => setImages(Array.from(e.target.files || []))} />
            {images.length > 0 && <p className="mt-1 text-xs text-gray-400">Đã chọn {images.length} ảnh</p>}
          </div>
          <Btn type="submit" className="md:col-span-3 w-full">Tạo sản phẩm</Btn>
        </form>
      </div>

      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Danh sách sản phẩm ({products.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Sản phẩm</th>
                <th className="px-4 py-3 text-left">Giá</th>
                <th className="px-4 py-3 text-left">Tồn kho</th>
                <th className="px-4 py-3 text-left">Danh mục</th>
                <th className="px-4 py-3 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.length === 0 && <tr><td colSpan={5}><EmptyState icon="📦" text="Chưa có sản phẩm nào" /></td></tr>}
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatPrice(p.price)}</td>
                  <td className="px-4 py-3"><Badge color={p.stock < 10 ? "red" : p.stock < 30 ? "yellow" : "green"}>{p.stock}</Badge></td>
                  <td className="px-4 py-3 text-gray-500">{catMap[p.category_id] || "—"}</td>
                  <td className="px-4 py-3 space-x-2">
                    <Btn variant="ghost" className="py-1 text-xs" onClick={() => setEditing({ ...p })}>✏️ Sửa</Btn>
                    <Btn variant="danger" className="py-1 text-xs" onClick={async () => { if (confirm("Xóa sản phẩm này?")) { await api.delete(`/admin/products/${p.id}`); await loadAll(); } }}>🗑️ Xóa</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal title="✏️ Chỉnh sửa sản phẩm" onClose={() => { setEditing(null); setEditImages([]); }}>
          <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
            <Input label="Tên sản phẩm" value={editing.name} onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))} />
            <Input label="Giá" type="number" value={editing.price} onChange={(e) => setEditing((s) => ({ ...s, price: e.target.value }))} />
            <Input label="Tồn kho" type="number" value={editing.stock} onChange={(e) => setEditing((s) => ({ ...s, stock: e.target.value }))} />
            <Input label="Thương hiệu" value={editing.brand || ""} onChange={(e) => setEditing((s) => ({ ...s, brand: e.target.value }))} />
            <Input label="Giảm giá (%)" type="number" value={editing.discount || 0} onChange={(e) => setEditing((s) => ({ ...s, discount: e.target.value }))} />
            <Select label="Danh mục" value={editing.category_id || ""} onChange={(e) => setEditing((s) => ({ ...s, category_id: e.target.value }))}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Mô tả</label>
              <textarea className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none h-20 resize-none" value={editing.description || ""} onChange={(e) => setEditing((s) => ({ ...s, description: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Thêm ảnh mới</label>
              <input type="file" multiple accept="image/*" className="w-full text-sm text-gray-500 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs" onChange={(e) => setEditImages(Array.from(e.target.files || []))} />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Btn type="submit" className="flex-1">Lưu thay đổi</Btn>
              <Btn type="button" variant="ghost" onClick={() => { setEditing(null); setEditImages([]); }}>Hủy</Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Danh mục ───────────────────────────────────────────────────────────────
function Categories({ categories, loadAll }) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post("/admin/categories", { name });
    setName("");
    await loadAll();
  };

  const save = async (e) => {
    e.preventDefault();
    await api.put(`/admin/categories/${editing.id}`, { name: editName });
    setEditing(null);
    await loadAll();
  };

  return (
    <div className="space-y-5 max-w-lg">
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-3">➕ Tạo danh mục</h3>
        <form onSubmit={create} className="flex gap-2">
          <input className="flex-1 rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-indigo-400" placeholder="Tên danh mục..." value={name} onChange={(e) => setName(e.target.value)} />
          <Btn type="submit">Tạo</Btn>
        </form>
      </div>
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b">
          <h3 className="font-bold text-gray-800">Danh sách danh mục ({categories.length})</h3>
        </div>
        {categories.length === 0 && <EmptyState icon="🗂️" text="Chưa có danh mục nào" />}
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-5 py-3 border-b last:border-0 hover:bg-gray-50 transition-colors">
            {editing?.id === c.id ? (
              <form onSubmit={save} className="flex flex-1 gap-2 mr-2">
                <input className="flex-1 rounded-xl border border-indigo-300 p-1.5 text-sm outline-none" value={editName} onChange={(e) => setEditName(e.target.value)} />
                <Btn type="submit" className="py-1 text-xs">Lưu</Btn>
                <Btn type="button" variant="ghost" className="py-1 text-xs" onClick={() => setEditing(null)}>Hủy</Btn>
              </form>
            ) : (
              <>
                <span className="text-sm text-gray-700">{c.name}</span>
                <div className="flex gap-2">
                  <Btn variant="ghost" className="py-1 text-xs" onClick={() => { setEditing(c); setEditName(c.name); }}>✏️ Sửa</Btn>
                  <Btn variant="danger" className="py-1 text-xs" onClick={async () => { if (confirm("Xóa danh mục này?")) { await api.delete(`/admin/categories/${c.id}`); await loadAll(); } }}>🗑️ Xóa</Btn>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Đơn hàng ───────────────────────────────────────────────────────────────
function Orders({ orders, loadAll }) {
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState("");
  const filtered = filter ? orders.filter((o) => o.status === filter) : orders;
  const statusColor = { placed: "blue", confirmed: "yellow", shipping: "orange", delivered: "green", cancelled: "red" };

  const openDetail = async (id) => {
    const res = await api.get(`/admin/orders/${id}`).catch(() => null);
    setDetail(res?.data || null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter("")} className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${!filter ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>Tất cả</button>
        {TRANG_THAI_DON.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${filter === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>{TRANG_THAI_VI[s]}</button>
        ))}
      </div>
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b">
          <h3 className="font-bold text-gray-800">Đơn hàng ({filtered.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Mã đơn</th>
                <th className="px-4 py-3 text-left">Khách hàng</th>
                <th className="px-4 py-3 text-left">Tổng tiền</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && <tr><td colSpan={5}><EmptyState icon="📑" text="Không có đơn hàng nào" /></td></tr>}
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-indigo-600 font-semibold">#{o.id}</td>
                  <td className="px-4 py-3 text-gray-700">{o.customer_name}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{formatPrice(o.total_price)}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-xl border border-gray-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
                      value={o.status}
                      onChange={async (e) => { await api.put(`/admin/orders/${o.id}/status`, { status: e.target.value }); await loadAll(); }}
                    >
                      {TRANG_THAI_DON.map((s) => <option key={s} value={s}>{TRANG_THAI_VI[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <Btn variant="ghost" className="py-1 text-xs" onClick={() => openDetail(o.id)}>🔍 Chi tiết</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {detail && (
        <Modal title={`📑 Chi tiết đơn hàng #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400 mb-1">Khách hàng</p><p className="font-semibold">{detail.customer_name}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400 mb-1">Trạng thái</p><Badge color={statusColor[detail.status] || "gray"}>{TRANG_THAI_VI[detail.status]}</Badge></div>
            </div>
            {detail.items?.length > 0 && (
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-400 mb-2">Sản phẩm</p>
                {detail.items.map((item, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b border-gray-200 last:border-0">
                    <span className="text-gray-700">{item.name} × {item.quantity}</span>
                    <span className="font-semibold text-indigo-600">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-3">
              <span>Tổng cộng</span>
              <span className="text-indigo-600">{formatPrice(detail.total_price)}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Người dùng ─────────────────────────────────────────────────────────────
function Users({ users, loadAll }) {
  const [search, setSearch] = useState("");
  const filtered = users.filter((u) => u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <input className="w-full max-w-sm rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-indigo-400" placeholder="🔍 Tìm theo tên hoặc email..." value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b">
          <h3 className="font-bold text-gray-800">Người dùng ({filtered.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Họ tên</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Vai trò</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && <tr><td colSpan={5}><EmptyState icon="👥" text="Không tìm thấy người dùng" /></td></tr>}
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-xl border border-gray-200 px-2 py-1 text-xs outline-none"
                      value={u.role}
                      onChange={async (e) => { await api.put(`/admin/users/${u.id}`, { role: e.target.value, is_blocked: u.is_blocked }); await loadAll(); }}
                    >
                      <option value="user">Khách hàng</option>
                      <option value="staff">Nhân viên</option>
                      <option value="admin">Quản trị</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={u.is_blocked ? "red" : "green"}>{u.is_blocked ? "Bị khóa" : "Hoạt động"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Btn
                      variant={u.is_blocked ? "success" : "danger"}
                      className="py-1 text-xs"
                      onClick={async () => { await api.put(`/admin/users/${u.id}`, { role: u.role, is_blocked: !u.is_blocked }); await loadAll(); }}
                    >
                      {u.is_blocked ? "🔓 Mở khóa" : "🔒 Khóa"}
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Thanh toán ─────────────────────────────────────────────────────────────
function Payments({ payments }) {
  const methodColor = { momo: "rose", vnpay: "blue", cod: "gray", bank: "indigo" };
  const statusColor = { paid: "green", pending: "yellow", failed: "red" };
  const methodVI = { momo: "MoMo", vnpay: "VNPay", cod: "Tiền mặt", bank: "Chuyển khoản" };
  const statusVI = { paid: "Đã thanh toán", pending: "Đang xử lý", failed: "Thất bại" };

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b">
        <h3 className="font-bold text-gray-800">Lịch sử thanh toán ({payments.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Mã đơn</th>
              <th className="px-4 py-3 text-left">Phương thức</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-left">Mã giao dịch</th>
              <th className="px-4 py-3 text-left">Số tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.length === 0 && <tr><td colSpan={5}><EmptyState icon="💰" text="Chưa có giao dịch nào" /></td></tr>}
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-indigo-600 font-semibold">#{p.id}</td>
                <td className="px-4 py-3"><Badge color={methodColor[p.payment_method?.toLowerCase()] || "gray"}>{methodVI[p.payment_method?.toLowerCase()] || p.payment_method}</Badge></td>
                <td className="px-4 py-3"><Badge color={statusColor[p.payment_status] || "gray"}>{statusVI[p.payment_status] || p.payment_status}</Badge></td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.transaction_id || "—"}</td>
                <td className="px-4 py-3 font-semibold text-gray-800">{formatPrice(p.total_price || p.amount || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Voucher ────────────────────────────────────────────────────────────────
function Vouchers({ vouchers, loadAll }) {
  const [form, setForm] = useState({ code: "", discount_percent: 10, min_order: 0, expired_at: "", is_active: true });
  const [editing, setEditing] = useState(null);

  const create = async (e) => {
    e.preventDefault();
    await api.post("/admin/vouchers", form);
    setForm({ code: "", discount_percent: 10, min_order: 0, expired_at: "", is_active: true });
    await loadAll();
  };

  const save = async (e) => {
    e.preventDefault();
    await api.put(`/admin/vouchers/${editing.id}`, editing);
    setEditing(null);
    await loadAll();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4">➕ Tạo voucher</h3>
        <form onSubmit={create} className="grid gap-3 md:grid-cols-2">
          <Input label="Mã voucher" placeholder="SALE2025" value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value.toUpperCase() }))} />
          <Input label="Giảm giá (%)" type="number" placeholder="10" value={form.discount_percent} onChange={(e) => setForm((s) => ({ ...s, discount_percent: e.target.value }))} />
          <Input label="Đơn tối thiểu (VNĐ)" type="number" placeholder="0" value={form.min_order} onChange={(e) => setForm((s) => ({ ...s, min_order: e.target.value }))} />
          <Input label="Hết hạn" type="datetime-local" value={form.expired_at} onChange={(e) => setForm((s) => ({ ...s, expired_at: e.target.value }))} />
          <Btn type="submit" className="md:col-span-2 w-full">Tạo voucher</Btn>
        </form>
      </div>
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b"><h3 className="font-bold text-gray-800">Danh sách voucher ({vouchers.length})</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Mã</th>
                <th className="px-4 py-3 text-left">Giảm</th>
                <th className="px-4 py-3 text-left">Đơn tối thiểu</th>
                <th className="px-4 py-3 text-left">Hết hạn</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vouchers.length === 0 && <tr><td colSpan={6}><EmptyState icon="🎟️" text="Chưa có voucher nào" /></td></tr>}
              {vouchers.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-indigo-600">{v.code}</td>
                  <td className="px-4 py-3"><Badge color="orange">{v.discount_percent}%</Badge></td>
                  <td className="px-4 py-3 text-gray-500">{formatPrice(v.min_order)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{v.expired_at ? new Date(v.expired_at).toLocaleString("vi-VN") : "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={async () => { await api.put(`/admin/vouchers/${v.id}`, { ...v, is_active: !v.is_active }); await loadAll(); }} className={`rounded-full px-3 py-0.5 text-xs font-semibold transition-all ${v.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                      {v.is_active ? "✅ Bật" : "⏸️ Tắt"}
                    </button>
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    <Btn variant="ghost" className="py-1 text-xs" onClick={() => setEditing({ ...v })}>✏️ Sửa</Btn>
                    <Btn variant="danger" className="py-1 text-xs" onClick={async () => { if (confirm("Xóa voucher?")) { await api.delete(`/admin/vouchers/${v.id}`); await loadAll(); } }}>🗑️</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && (
        <Modal title="✏️ Chỉnh sửa voucher" onClose={() => setEditing(null)}>
          <form onSubmit={save} className="grid gap-3">
            <Input label="Mã voucher" value={editing.code} onChange={(e) => setEditing((s) => ({ ...s, code: e.target.value.toUpperCase() }))} />
            <Input label="Giảm giá (%)" type="number" value={editing.discount_percent} onChange={(e) => setEditing((s) => ({ ...s, discount_percent: e.target.value }))} />
            <Input label="Đơn tối thiểu" type="number" value={editing.min_order} onChange={(e) => setEditing((s) => ({ ...s, min_order: e.target.value }))} />
            <Input label="Hết hạn" type="datetime-local" value={editing.expired_at?.slice(0, 16)} onChange={(e) => setEditing((s) => ({ ...s, expired_at: e.target.value }))} />
            <div className="flex gap-2">
              <Btn type="submit" className="flex-1">Lưu</Btn>
              <Btn type="button" variant="ghost" onClick={() => setEditing(null)}>Hủy</Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Flash Sale ──────────────────────────────────────────────────────────────
function FlashSales({ flashSales, products, loadAll }) {
  const [form, setForm] = useState({ product_id: "", discount_percent: 10, start_time: "", end_time: "" });
  const now = new Date();

  const create = async (e) => {
    e.preventDefault();
    await api.post("/admin/flash-sales", form);
    setForm({ product_id: "", discount_percent: 10, start_time: "", end_time: "" });
    await loadAll();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4">⚡ Tạo Flash Sale</h3>
        <form onSubmit={create} className="grid gap-3 md:grid-cols-2">
          <Select label="Sản phẩm" value={form.product_id} onChange={(e) => setForm((s) => ({ ...s, product_id: e.target.value }))}>
            <option value="">-- Chọn sản phẩm --</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Input label="Giảm giá (%)" type="number" value={form.discount_percent} onChange={(e) => setForm((s) => ({ ...s, discount_percent: e.target.value }))} />
          <Input label="Bắt đầu" type="datetime-local" value={form.start_time} onChange={(e) => setForm((s) => ({ ...s, start_time: e.target.value }))} />
          <Input label="Kết thúc" type="datetime-local" value={form.end_time} onChange={(e) => setForm((s) => ({ ...s, end_time: e.target.value }))} />
          <Btn type="submit" variant="orange" className="md:col-span-2 w-full">⚡ Tạo Flash Sale</Btn>
        </form>
      </div>
      <div className="space-y-3">
        {flashSales.length === 0 && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm border border-gray-100">
            <EmptyState icon="⚡" text="Chưa có flash sale nào" />
          </div>
        )}
        {flashSales.map((fs) => {
          const isActive = new Date(fs.start_time) <= now && now <= new Date(fs.end_time);
          const isPending = new Date(fs.start_time) > now;
          return (
            <div key={fs.id} className={`rounded-2xl p-4 shadow-sm border flex items-center justify-between transition-all ${isActive ? "bg-orange-50 border-orange-200" : "bg-white border-gray-100"}`}>
              <div>
                <p className="font-semibold text-gray-800">{fs.product_name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Giảm <span className="font-bold text-orange-600">{fs.discount_percent}%</span> · {new Date(fs.start_time).toLocaleString("vi-VN")} → {new Date(fs.end_time).toLocaleString("vi-VN")}
                </p>
                {isActive && <p className="text-xs mt-1 text-orange-600">⏱️ Kết thúc sau: <Countdown endTime={fs.end_time} /></p>}
                {isPending && <p className="text-xs mt-1 text-blue-600">⏳ Bắt đầu sau: <Countdown endTime={fs.start_time} /></p>}
              </div>
              <div className="flex items-center gap-3">
                <Badge color={isActive ? "orange" : isPending ? "blue" : "gray"}>{isActive ? "Đang diễn ra" : isPending ? "Sắp bắt đầu" : "Đã kết thúc"}</Badge>
                <Btn variant="danger" className="py-1 text-xs" onClick={async () => { if (confirm("Xóa flash sale?")) { await api.delete(`/admin/flash-sales/${fs.id}`); await loadAll(); } }}>🗑️ Xóa</Btn>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Thông báo ───────────────────────────────────────────────────────────────
function Notifications({ users }) {
  const [tab, setTab] = useState("broadcast");
  const [broadcast, setBroadcast] = useState({ title: "", message: "" });
  const [targeted, setTargeted] = useState({ user_id: "", title: "", message: "" });
  const [sent, setSent] = useState(false);

  const sendBroadcast = async (e) => {
    e.preventDefault();
    await api.post("/admin/notifications/broadcast", broadcast);
    setBroadcast({ title: "", message: "" });
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  const sendTargeted = async (e) => {
    e.preventDefault();
    await api.post("/admin/notifications/send", targeted);
    setTargeted({ user_id: "", title: "", message: "" });
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex gap-2">
        {[["broadcast", "📢 Broadcast"], ["targeted", "🎯 Cá nhân"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${tab === k ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>{l}</button>
        ))}
      </div>
      {sent && <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">✅ Gửi thông báo thành công!</div>}
      {tab === "broadcast" && (
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">📢 Gửi thông báo toàn hệ thống</h3>
          <form onSubmit={sendBroadcast} className="space-y-3">
            <Input label="Tiêu đề" placeholder="Nhập tiêu đề..." value={broadcast.title} onChange={(e) => setBroadcast((s) => ({ ...s, title: e.target.value }))} />
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nội dung</label>
              <textarea className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none h-28 resize-none focus:border-indigo-400" value={broadcast.message} onChange={(e) => setBroadcast((s) => ({ ...s, message: e.target.value }))} />
            </div>
            <Btn type="submit" className="w-full">Gửi cho tất cả người dùng</Btn>
          </form>
        </div>
      )}
      {tab === "targeted" && (
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">🎯 Gửi thông báo cho người dùng cụ thể</h3>
          <form onSubmit={sendTargeted} className="space-y-3">
            <Select label="Chọn người dùng" value={targeted.user_id} onChange={(e) => setTargeted((s) => ({ ...s, user_id: e.target.value }))}>
              <option value="">-- Chọn người dùng --</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </Select>
            <Input label="Tiêu đề" placeholder="Nhập tiêu đề..." value={targeted.title} onChange={(e) => setTargeted((s) => ({ ...s, title: e.target.value }))} />
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nội dung</label>
              <textarea className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none h-28 resize-none" value={targeted.message} onChange={(e) => setTargeted((s) => ({ ...s, message: e.target.value }))} />
            </div>
            <Btn type="submit" variant="success" className="w-full">Gửi thông báo</Btn>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Chat ────────────────────────────────────────────────────────────────────
function Chat() {
  const [conversations, setConversations] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [thread, setThread] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  const loadConvs = useCallback(async () => {
    const res = await api.get("/chat/conversations").catch(() => null);
    if (res) setConversations(res.data);
  }, []);

  useEffect(() => { loadConvs(); }, [loadConvs]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const openThread = async (userId) => {
    setActiveUser(userId);
    const res = await api.get(`/chat/thread/${userId}`).catch(() => null);
    if (res) setThread(res.data);
  };

  const send = async () => {
    if (!activeUser || !text.trim()) return;
    await api.post("/chat/send", { receiver_id: activeUser, message: text });
    setText("");
    openThread(activeUser);
  };

  const activeConv = conversations.find((c) => c.user_id === activeUser);

  return (
    <div className="grid gap-4 md:grid-cols-3 h-[calc(100vh-200px)] min-h-[500px]">
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-bold text-gray-800">💬 Hội thoại</h3>
          <button onClick={loadConvs} className="text-xs text-indigo-600 hover:underline font-medium">Làm mới</button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {conversations.length === 0 && <EmptyState icon="💬" text="Chưa có tin nhắn nào" />}
          {conversations.map((c) => (
            <button key={c.user_id} onClick={() => openThread(c.user_id)} className={`block w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${activeUser === c.user_id ? "bg-indigo-50 border-r-2 border-indigo-500" : ""}`}>
              <p className="font-semibold text-sm text-gray-800">{c.name}</p>
              <p className="text-xs text-gray-400 truncate">{c.last_message || c.email}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="md:col-span-2 rounded-2xl bg-white shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-800">{activeConv ? `${activeConv.name} — ${activeConv.email}` : "Chọn hội thoại"}</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!activeUser && <EmptyState icon="👈" text="Chọn người dùng để xem hội thoại" />}
          {thread.map((m) => (
            <div key={m.id} className={`flex ${m.sender_id === activeUser ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-xs rounded-2xl px-4 py-2 text-sm shadow-sm ${m.sender_id === activeUser ? "bg-gray-100 text-gray-800" : "bg-indigo-600 text-white"}`}>
                {m.message}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {activeUser && (
          <div className="px-4 py-3 border-t flex gap-2">
            <input
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              placeholder="Nhập tin nhắn..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            />
            <Btn onClick={send}>Gửi</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function AdminPanelPage() {
  const [active, setActive] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [flashSales, setFlashSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [broadcast, setBroadcast] = useState({ title: "", message: "" });

  const loadAll = useCallback(async () => {
    try {
      const [s, p, c, o, u, v, fs, pay] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/products"),
        api.get("/admin/categories"),
        api.get("/admin/orders"),
        api.get("/admin/users"),
        api.get("/admin/vouchers"),
        api.get("/admin/flash-sales"),
        api.get("/admin/payments"),
      ]);
      setStats(s.data);
      setProducts(Array.isArray(p.data) ? p.data : []);
      setCategories(Array.isArray(c.data) ? c.data : []);
      setOrders(Array.isArray(o.data) ? o.data : []);
      setUsers(Array.isArray(u.data) ? u.data : []);
      setVouchers(Array.isArray(v.data) ? v.data : []);
      setFlashSales(Array.isArray(fs.data) ? fs.data : []);
      setPayments(Array.isArray(pay.data) ? pay.data : []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-refresh stats mỗi 60 giây
  useEffect(() => {
    const t = setInterval(() => {
      api.get("/admin/stats").then((res) => setStats(res.data)).catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const sendBroadcast = async (e) => {
    e.preventDefault();
    await api.post("/admin/notifications/broadcast", broadcast);
    setBroadcast({ title: "", message: "" });
  };

  const activeMenu = MENU.find((m) => m.key === active);

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-16"} flex-shrink-0 bg-white border-r border-gray-100 flex flex-col transition-all duration-200 shadow-sm`}>
        <div className="flex h-14 items-center justify-between px-4 border-b border-gray-100">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black">A</div>
              <span className="font-bold text-gray-800 text-sm">Admin</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen((v) => !v)} className="text-gray-400 hover:text-gray-600 ml-auto p-1 rounded-lg hover:bg-gray-100 transition-colors">
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
          {MENU.map((m) => (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              title={m.label}
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-all ${
                active === m.key
                  ? "bg-indigo-50 text-indigo-700 font-semibold shadow-sm"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              <span className="text-base">{m.icon}</span>
              {sidebarOpen && <span className="truncate">{m.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          {sidebarOpen && <p className="text-xs text-gray-300 text-center">Admin Panel v2.0</p>}
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center px-6 gap-3 shadow-sm">
          <h1 className="font-bold text-gray-800">{activeMenu?.icon} {activeMenu?.label}</h1>
          <div className="ml-auto flex items-center gap-3 text-sm text-gray-500">
            <span className="hidden md:block text-xs">Xin chào, Admin</span>
            <button
              onClick={loadAll}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors"
            >
              🔄 Tải lại
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
                <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-gray-400">Đang tải dữ liệu...</p>
            </div>
          ) : (
            <>
              {active === "dashboard"    && <Dashboard stats={stats} products={products} broadcast={broadcast} setBroadcast={setBroadcast} sendBroadcast={sendBroadcast} onRefresh={loadAll} />}
              {active === "products"     && <Products products={products} categories={categories} loadAll={loadAll} />}
              {active === "categories"   && <Categories categories={categories} loadAll={loadAll} />}
              {active === "orders"       && <Orders orders={orders} loadAll={loadAll} />}
              {active === "users"        && <Users users={users} loadAll={loadAll} />}
              {active === "payments"     && <Payments payments={payments} />}
              {active === "vouchers"     && <Vouchers vouchers={vouchers} loadAll={loadAll} />}
              {active === "flash_sales"  && <FlashSales flashSales={flashSales} products={products} loadAll={loadAll} />}
              {active === "notifications"&& <Notifications users={users} />}
              {active === "chat"         && <Chat />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}