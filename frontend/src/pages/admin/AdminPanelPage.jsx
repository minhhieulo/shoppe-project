import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../../services/api";
import { formatPrice } from "../../utils/format";

// ─── Hằng số ───────────────────────────────────────────────────────────────
const TRANG_THAI_DON = ["placed", "confirmed", "shipping", "delivered", "cancelled"];
const TRANG_THAI_VI = {
  placed: "Đã đặt",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
};
const ROLE_VI = { user: "Khách hàng", staff: "Nhân viên", admin: "Quản trị" };

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
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[color] || colors.gray}`}>{children}</span>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color = "indigo" }) {
  const colors = {
    indigo: "from-indigo-500 to-indigo-600",
    green:  "from-emerald-500 to-emerald-600",
    orange: "from-orange-500 to-orange-600",
    rose:   "from-rose-500 to-rose-600",
  };
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`rounded-lg bg-gradient-to-br ${colors[color]} p-2.5 text-xl shadow`}>{icon}</div>
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>}
      <input className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" {...props} />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>}
      <select className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" {...props}>
        {children}
      </select>
    </div>
  );
}

function Btn({ variant = "primary", className = "", ...props }) {
  const base = "rounded-lg px-4 py-2 text-sm font-medium transition-all active:scale-95 disabled:opacity-50";
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
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-sm">{text}</p>
    </div>
  );
}

// ─── Phần Dashboard ─────────────────────────────────────────────────────────
function Dashboard({ stats, products, broadcast, setBroadcast, sendBroadcast }) {
  const lowStock = products.filter((p) => p.stock < 10);
  const [period, setPeriod] = useState("Ngày");
  const [chartData, setChartData] = useState(stats?.revenueChart || []);
  const [chartLoading, setChartLoading] = useState(false);
  const periodMap = { "Ngày": "day", "Tháng": "month", "Năm": "year" };

  const loadChart = async (p) => {
    setPeriod(p);
    setChartLoading(true);
    try {
      const res = await api.get(`/admin/stats/revenue?period=${periodMap[p]}`);
      setChartData(res.data?.revenueChart || res.data || []);
    } catch {
      setChartData(stats?.revenueChart || []);
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => { setChartData(stats?.revenueChart || []); }, [stats]);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="👤" label="Tổng người dùng" value={stats?.totalUsers ?? "—"} color="indigo" />
        <StatCard icon="📑" label="Tổng đơn hàng" value={stats?.totalOrders ?? "—"} color="green" />
        <StatCard icon="📦" label="Tổng sản phẩm" value={stats?.totalProducts ?? "—"} color="orange" />
        <StatCard icon="💰" label="Doanh thu" value={stats ? formatPrice(stats.totalRevenue) : "—"} color="rose" />
      </div>

      {/* Biểu đồ doanh thu + Top sản phẩm */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Biểu đồ */}
        <div className="lg:col-span-2 rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">📈 Doanh thu theo {period.toLowerCase()}</h3>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {["Ngày", "Tháng", "Năm"].map((t) => (
                <button
                  key={t}
                  onClick={() => loadChart(t)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${period === t ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {chartLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="text-indigo-400 text-2xl animate-spin">⚙️</div>
            </div>
          ) : chartData?.length ? (
            <RevenueChart data={chartData} />
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
              Chưa có dữ liệu biểu đồ
            </div>
          )}
        </div>

        {/* Top sản phẩm */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-3">🏆 Sản phẩm bán chạy</h3>
          {stats?.topProducts?.length ? (
            <ol className="space-y-2">
              {stats.topProducts.slice(0, 5).map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-yellow-400 text-white" : "bg-gray-100 text-gray-500"}`}>{i + 1}</span>
                  <span className="flex-1 truncate text-gray-700">{p.name}</span>
                  <span className="text-gray-400 text-xs">{p.sold} đã bán</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-400">Chưa có dữ liệu</p>
          )}
        </div>
      </div>

      {/* Cảnh báo tồn kho thấp */}
      {lowStock.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <h3 className="font-semibold text-orange-700 mb-2">⚠️ Cảnh báo tồn kho thấp ({lowStock.length} sản phẩm)</h3>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((p) => (
              <span key={p.id} className="rounded-lg border border-orange-200 bg-white px-3 py-1 text-xs text-orange-700">
                {p.name} — còn <strong>{p.stock}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Broadcast */}
      <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-3">🔔 Gửi thông báo toàn hệ thống</h3>
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

// Biểu đồ SVG đẹp với tooltip + trục
function RevenueChart({ data }) {
  const [tooltip, setTooltip] = useState(null);
  if (!data?.length) return null;

  const W = 600, H = 200, padL = 70, padR = 20, padT = 20, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const max = Math.max(...data.map((d) => d.value), 1);
  const range = max || 1;

  const pts = data.map((d, i) => ({
    x: padL + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padT + chartH - (d.value / range) * chartH,
    value: d.value,
    label: d.label,
  }));

  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `M${pts[0].x},${padT + chartH} ` + pts.map((p) => `L${p.x},${p.y}`).join(" ") + ` L${pts[pts.length - 1].x},${padT + chartH} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ y: padT + chartH - t * chartH, value: t * max }));
  const fmt = (v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="#f0f0f0" strokeWidth="1" />
            <text x={padL - 8} y={t.y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{fmt(t.value)}</text>
          </g>
        ))}
        {pts.filter((_, i) => data.length <= 12 || i % Math.ceil(data.length / 10) === 0).map((p, i) => (
          <text key={i} x={p.x} y={H - 8} textAnchor="middle" fontSize="10" fill="#9ca3af">{p.label}</text>
        ))}
        <path d={area} fill="url(#revGrad)" />
        <polyline points={polyline} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#6366f1" stroke="white" strokeWidth="2"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setTooltip(p)}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
        {tooltip && (() => {
          const tx = Math.min(tooltip.x, W - 110);
          const ty = Math.max(tooltip.y - 44, padT);
          return (
            <g>
              <rect x={tx - 10} y={ty - 16} width="120" height="34" rx="6" fill="#1f2937" opacity="0.92" />
              <text x={tx + 50} y={ty - 2} textAnchor="middle" fontSize="10" fill="#d1d5db">{tooltip.label}</text>
              <text x={tx + 50} y={ty + 13} textAnchor="middle" fontSize="11" fill="white" fontWeight="bold">
                {tooltip.value.toLocaleString("vi-VN")}đ
              </text>
            </g>
          );
        })()}
      </svg>
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
    <Input {...props} value={form[field]} onChange={(e) => setForm((s) => ({ ...s, [field]: e.target.value })) } />
  );

  return (
    <div className="space-y-5">
      {/* Form tạo */}
      <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">➕ Tạo sản phẩm mới</h3>
        <form onSubmit={create} className="grid gap-3 md:grid-cols-3">
          <F field="name" label="Tên sản phẩm" placeholder="Nhập tên..." />
          <F field="price" label="Giá (VNĐ)" placeholder="0" type="number" />
          <F field="stock" label="Tồn kho" placeholder="0" type="number" />
          <F field="brand" label="Thương hiệu" placeholder="Apple, Samsung..." />
          <F field="discount" label="Giảm giá (%)" placeholder="0" type="number" />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Danh mục</label>
            <select className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-indigo-400" value={form.category_id} onChange={(e) => setForm((s) => ({ ...s, category_id: e.target.value }))}>
              <option value="">-- Chọn danh mục --</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">Mô tả</label>
            <textarea className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-indigo-400 h-20 resize-none" placeholder="Mô tả sản phẩm..." value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">Ảnh sản phẩm (nhiều ảnh)</label>
            <input type="file" multiple accept="image/*" className="w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-600" onChange={(e) => setImages(Array.from(e.target.files || []))} />
            {images.length > 0 && <p className="mt-1 text-xs text-gray-400">Đã chọn {images.length} ảnh</p>}
          </div>
          <Btn type="submit" className="md:col-span-3 w-full">Tạo sản phẩm</Btn>
        </form>
      </div>

      {/* Bảng sản phẩm */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Danh sách sản phẩm ({products.length})</h3>
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
              {products.length === 0 && (
                <tr><td colSpan={5}><EmptyState icon="📦" text="Chưa có sản phẩm nào" /></td></tr>
              )}
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatPrice(p.price)}</td>
                  <td className="px-4 py-3">
                    <Badge color={p.stock < 10 ? "red" : p.stock < 30 ? "yellow" : "green"}>{p.stock}</Badge>
                  </td>
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

      {/* Modal sửa */}
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
              <textarea className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none h-20 resize-none" value={editing.description || ""} onChange={(e) => setEditing((s) => ({ ...s, description: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Thêm ảnh mới</label>
              <input type="file" multiple accept="image/*" className="w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs" onChange={(e) => setEditImages(Array.from(e.target.files || []))} />
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
      <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-3">➕ Tạo danh mục</h3>
        <form onSubmit={create} className="flex gap-2">
          <input className="flex-1 rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-indigo-400" placeholder="Tên danh mục..." value={name} onChange={(e) => setName(e.target.value)} />
          <Btn type="submit">Tạo</Btn>
        </form>
      </div>
      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b">
          <h3 className="font-semibold text-gray-800">Danh sách danh mục ({categories.length})</h3>
        </div>
        {categories.length === 0 && <EmptyState icon="🗂️" text="Chưa có danh mục nào" />}
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-5 py-3 border-b last:border-0">
            {editing?.id === c.id ? (
              <form onSubmit={save} className="flex flex-1 gap-2 mr-2">
                <input className="flex-1 rounded-lg border border-indigo-300 p-1.5 text-sm outline-none" value={editName} onChange={(e) => setEditName(e.target.value)} />
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
        <button onClick={() => setFilter("")} className={`rounded-full px-3 py-1 text-xs font-medium border ${!filter ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200"}`}>Tất cả</button>
        {TRANG_THAI_DON.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 text-xs font-medium border ${filter === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200"}`}>{TRANG_THAI_VI[s]}</button>
        ))}
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b">
          <h3 className="font-semibold text-gray-800">Đơn hàng ({filtered.length})</h3>
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
              {filtered.length === 0 && (
                <tr><td colSpan={5}><EmptyState icon="📑" text="Không có đơn hàng nào" /></td></tr>
              )}
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-indigo-600">#{o.id}</td>
                  <td className="px-4 py-3 text-gray-700">{o.customer_name}</td>
                  <td className="px-4 py-3 font-medium">{formatPrice(o.total_price)}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none"
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
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-xs text-gray-500">Khách hàng</p><p className="font-medium">{detail.customer_name}</p></div>
              <div><p className="text-xs text-gray-500">Trạng thái</p><Badge color={statusColor[detail.status] || "gray"}>{TRANG_THAI_VI[detail.status]}</Badge></div>
              <div><p className="text-xs text-gray-500">Địa chỉ giao hàng</p><p>{detail.address || "—"}</p></div>
              <div><p className="text-xs text-gray-500">Ghi chú</p><p>{detail.note || "Không có"}</p></div>
            </div>
            {detail.items?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Sản phẩm</p>
                {detail.items.map((item, i) => (
                  <div key={i} className="flex justify-between border-b py-1">
                    <span>{item.name} × {item.quantity}</span>
                    <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-2">
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
      <input className="w-full max-w-sm rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-indigo-400" placeholder="🔍 Tìm theo tên hoặc email..." value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b">
          <h3 className="font-semibold text-gray-800">Người dùng ({filtered.length})</h3>
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
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none"
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
  const statusColor = { success: "green", pending: "yellow", failed: "red" };
  const methodVI = { momo: "MoMo", vnpay: "VNPay", cod: "Tiền mặt", bank: "Chuyển khoản" };
  const statusVI = { success: "Thành công", pending: "Đang xử lý", failed: "Thất bại" };

  return (
    <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b">
        <h3 className="font-semibold text-gray-800">Lịch sử thanh toán ({payments.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Mã</th>
              <th className="px-4 py-3 text-left">Phương thức</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-left">Mã giao dịch</th>
              <th className="px-4 py-3 text-left">Số tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.length === 0 && <tr><td colSpan={5}><EmptyState icon="💰" text="Chưa có giao dịch nào" /></td></tr>}
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-indigo-600">#{p.id}</td>
                <td className="px-4 py-3"><Badge color={methodColor[p.payment_method] || "gray"}>{methodVI[p.payment_method] || p.payment_method}</Badge></td>
                <td className="px-4 py-3"><Badge color={statusColor[p.payment_status] || "gray"}>{statusVI[p.payment_status] || p.payment_status}</Badge></td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.transaction_id || "—"}</td>
                <td className="px-4 py-3 font-medium">{p.amount ? formatPrice(p.amount) : "—"}</td>
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
      <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">➕ Tạo voucher</h3>
        <form onSubmit={create} className="grid gap-3 md:grid-cols-2">
          <Input label="Mã voucher" placeholder="SALE2025" value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value.toUpperCase() }))} />
          <Input label="Giảm giá (%)" type="number" placeholder="10" value={form.discount_percent} onChange={(e) => setForm((s) => ({ ...s, discount_percent: e.target.value }))} />
          <Input label="Đơn tối thiểu (VNĐ)" type="number" placeholder="0" value={form.min_order} onChange={(e) => setForm((s) => ({ ...s, min_order: e.target.value }))} />
          <Input label="Hết hạn" type="datetime-local" value={form.expired_at} onChange={(e) => setForm((s) => ({ ...s, expired_at: e.target.value }))} />
          <Btn type="submit" className="md:col-span-2 w-full">Tạo voucher</Btn>
        </form>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b"><h3 className="font-semibold text-gray-800">Danh sách voucher ({vouchers.length})</h3></div>
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
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-indigo-600">{v.code}</td>
                  <td className="px-4 py-3"><Badge color="orange">{v.discount_percent}%</Badge></td>
                  <td className="px-4 py-3 text-gray-500">{formatPrice(v.min_order)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{v.expired_at ? new Date(v.expired_at).toLocaleString("vi-VN") : "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={async () => { await api.put(`/admin/vouchers/${v.id}`, { ...v, is_active: !v.is_active }); await loadAll(); }} className={`rounded-full px-3 py-0.5 text-xs font-medium ${v.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
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

  const create = async (e) => {
    e.preventDefault();
    await api.post("/admin/flash-sales", form);
    setForm({ product_id: "", discount_percent: 10, start_time: "", end_time: "" });
    await loadAll();
  };

  const now = new Date();

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">⚡ Tạo Flash Sale</h3>
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
          <div className="rounded-xl bg-white p-8 text-center shadow-sm border border-gray-100">
            <EmptyState icon="⚡" text="Chưa có flash sale nào" />
          </div>
        )}
        {flashSales.map((fs) => {
          const isActive = new Date(fs.start_time) <= now && now <= new Date(fs.end_time);
          const isPending = new Date(fs.start_time) > now;
          return (
            <div key={fs.id} className={`rounded-xl p-4 shadow-sm border flex items-center justify-between ${isActive ? "bg-orange-50 border-orange-200" : "bg-white border-gray-100"}`}>
              <div>
                <p className="font-semibold text-gray-800">{fs.product_name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Giảm <span className="font-bold text-orange-600">{fs.discount_percent}%</span> • {new Date(fs.start_time).toLocaleString("vi-VN")} → {new Date(fs.end_time).toLocaleString("vi-VN")}
                </p>
                {isActive && (
                  <p className="text-xs mt-1 text-orange-600">⏱️ Kết thúc sau: <Countdown endTime={fs.end_time} /></p>
                )}
                {isPending && (
                  <p className="text-xs mt-1 text-blue-600">⏳ Bắt đầu sau: <Countdown endTime={fs.start_time} /></p>
                )}
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
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === k ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>{l}</button>
        ))}
      </div>

      {sent && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">✅ Gửi thông báo thành công!</div>}

      {tab === "broadcast" && (
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">📢 Gửi thông báo toàn hệ thống</h3>
          <form onSubmit={sendBroadcast} className="space-y-3">
            <Input label="Tiêu đề" placeholder="Nhập tiêu đề..." value={broadcast.title} onChange={(e) => setBroadcast((s) => ({ ...s, title: e.target.value }))} />
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nội dung</label>
              <textarea className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none h-28 resize-none focus:border-indigo-400" placeholder="Nội dung thông báo..." value={broadcast.message} onChange={(e) => setBroadcast((s) => ({ ...s, message: e.target.value }))} />
            </div>
            <Btn type="submit" className="w-full">Gửi cho tất cả người dùng</Btn>
          </form>
        </div>
      )}

      {tab === "targeted" && (
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">🎯 Gửi thông báo cho người dùng cụ thể</h3>
          <form onSubmit={sendTargeted} className="space-y-3">
            <Select label="Chọn người dùng" value={targeted.user_id} onChange={(e) => setTargeted((s) => ({ ...s, user_id: e.target.value }))}>
              <option value="">-- Chọn người dùng --</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </Select>
            <Input label="Tiêu đề" placeholder="Nhập tiêu đề..." value={targeted.title} onChange={(e) => setTargeted((s) => ({ ...s, title: e.target.value }))} />
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nội dung</label>
              <textarea className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none h-28 resize-none" placeholder="Nội dung..." value={targeted.message} onChange={(e) => setTargeted((s) => ({ ...s, message: e.target.value }))} />
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

  const loadConvs = useCallback(async () => {
    const res = await api.get("/chat/conversations").catch(() => null);
    if (res) setConversations(res.data);
  }, []);

  useEffect(() => { loadConvs(); }, [loadConvs]);

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
      {/* Danh sách */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">💬 Hội thoại</h3>
          <button onClick={loadConvs} className="text-xs text-indigo-600 hover:underline">Làm mới</button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {conversations.length === 0 && <EmptyState icon="💬" text="Chưa có tin nhắn nào" />}
          {conversations.map((c) => (
            <button key={c.user_id} onClick={() => openThread(c.user_id)} className={`block w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${activeUser === c.user_id ? "bg-indigo-50 border-r-2 border-indigo-500" : ""}`}>
              <p className="font-medium text-sm text-gray-800">{c.name}</p>
              <p className="text-xs text-gray-400 truncate">{c.email}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Khung chat */}
      <div className="md:col-span-2 rounded-xl bg-white shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-800">{activeConv ? `${activeConv.name} — ${activeConv.email}` : "Chọn hội thoại"}</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!activeUser && <EmptyState icon="👈" text="Chọn người dùng để xem hội thoại" />}
          {thread.map((m) => (
            <div key={m.id} className={`flex ${m.sender_id === activeUser ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-xs rounded-2xl px-3 py-2 text-sm ${m.sender_id === activeUser ? "bg-gray-100 text-gray-800" : "bg-indigo-600 text-white"}`}>
                {m.message}
              </div>
            </div>
          ))}
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
      setProducts(p.data);
      setCategories(c.data);
      setOrders(o.data);
      setUsers(u.data);
      setVouchers(v.data);
      setFlashSales(fs.data);
      setPayments(pay.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const sendBroadcast = async (e) => {
    e.preventDefault();
    await api.post("/admin/notifications/broadcast", broadcast);
    setBroadcast({ title: "", message: "" });
  };

  const activeMenu = MENU.find((m) => m.key === active);

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-16"} flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-200`}>
        <div className="flex h-14 items-center justify-between px-4 border-b border-gray-100">
          {sidebarOpen && <span className="font-bold text-gray-800 text-sm tracking-tight">⚙️ Quản trị</span>}
          <button onClick={() => setSidebarOpen((v) => !v)} className="text-gray-400 hover:text-gray-600 ml-auto">
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
          {MENU.map((m) => (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              title={m.label}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${active === m.key ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-600 hover:bg-gray-100"}`}
            >
              <span className="text-base">{m.icon}</span>
              {sidebarOpen && <span className="truncate">{m.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          {sidebarOpen && <p className="text-xs text-gray-400 text-center">Admin Panel v2.0</p>}
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-3">
          <h1 className="font-semibold text-gray-800">{activeMenu?.icon} {activeMenu?.label}</h1>
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
            <span className="hidden md:block">Xin chào, Admin</span>
            <button onClick={loadAll} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors">🔄 Tải lại</button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <div className="text-4xl mb-3 animate-spin">⚙️</div>
                <p className="text-sm">Đang tải dữ liệu...</p>
              </div>
            </div>
          ) : (
            <>
              {active === "dashboard" && <Dashboard stats={stats} products={products} broadcast={broadcast} setBroadcast={setBroadcast} sendBroadcast={sendBroadcast} />}
              {active === "products" && <Products products={products} categories={categories} loadAll={loadAll} />}
              {active === "categories" && <Categories categories={categories} loadAll={loadAll} />}
              {active === "orders" && <Orders orders={orders} loadAll={loadAll} />}
              {active === "users" && <Users users={users} loadAll={loadAll} />}
              {active === "payments" && <Payments payments={payments} />}
              {active === "vouchers" && <Vouchers vouchers={vouchers} loadAll={loadAll} />}
              {active === "flash_sales" && <FlashSales flashSales={flashSales} products={products} loadAll={loadAll} />}
              {active === "notifications" && <Notifications users={users} />}
              {active === "chat" && <Chat />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}