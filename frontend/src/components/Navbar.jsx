import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import api from "../services/api";
import { useDebounce } from "../hooks/useDebounce";
import { useStore } from "../store/useStore";

export default function Navbar() {
  const navigate = useNavigate();
  const { user, cartCount, wishlistCount, setUser, searchHistory, setSearchHistory } = useStore();
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [popular, setPopular] = useState([]);
  const [notis, setNotis] = useState([]);
  const [showNoti, setShowNoti] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const debouncedQ = useDebounce(q, 300);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get("/search-history").then((res) => setSearchHistory(res.data)).catch(() => {});
  }, [user, setSearchHistory]);

  useEffect(() => {
    api.get("/search/popular").then((res) => setPopular(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!debouncedQ.trim()) { setSuggestions([]); return; }
    api.get("/products/suggest", { params: { q: debouncedQ } })
      .then((res) => setSuggestions(res.data))
      .catch(() => setSuggestions([]));
  }, [debouncedQ]);

  const fetchNotis = () => {
    if (!user) return;
    api.get("/notifications").then((res) => {
      // Backend trả về { notifications: [], unreadCount: N } hoặc array
      const list = Array.isArray(res.data) ? res.data : (res.data?.notifications ?? []);
      setNotis(list.slice(0, 6));
    }).catch(() => {});
  };

  useEffect(() => {
    fetchNotis();
    if (!user) return;
    const t = setInterval(fetchNotis, 30000); // poll mỗi 30 giây
    return () => clearInterval(t);
  }, [user]);

  const doSearch = async (keyword) => {
    const term = (keyword ?? q).trim();
    if (!term) return;
    if (user) api.post("/search-history", { keyword: term }).catch(() => {});
    navigate(`/products?q=${encodeURIComponent(term)}`);
    setSuggestions([]);
    setQ("");
  };

  const dropdownItems =
    q.length === 0
      ? searchHistory.slice(0, 6).map((item, i) => ({ id: `hist-${i}`, name: item, isHistory: true }))
      : suggestions.map((s, i) => ({ id: s.id != null ? `sug-${s.id}` : `sug-${i}`, name: s.name }));

  const handleLogout = () => {
    api.post("/auth/logout", { refreshToken: localStorage.getItem("refreshToken") }).catch(() => {});
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
    setShowUserMenu(false);
    navigate("/login");
  };

  const unreadNotis = notis.filter((n) => !n.is_read).length;

  return (
    <header className={`sticky top-0 z-30 transition-shadow duration-300 ${scrolled ? "shadow-lg" : "shadow-sm"}`}>
      {/* ── Top bar ── */}
      <div className="bg-[#cc2200] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-xs">
          <div className="flex items-center gap-4">
            {[
              { label: "Kênh người bán", icon: "🏪" },
              { label: "Tải ứng dụng", icon: "📱" },
              { label: "Kết nối", icon: "🔗" },
            ].map(({ label, icon }) => (
              <button key={label} className="flex items-center gap-1 text-orange-100 hover:text-white transition-colors">
                <span>{icon}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => { const next = !showNoti; setShowNoti(next); setShowUserMenu(false); if (next) fetchNotis(); }}
                className="relative flex items-center gap-1 text-orange-100 hover:text-white transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="hidden sm:inline">Thông báo</span>
                {unreadNotis > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[9px] font-black text-gray-900">
                    {unreadNotis}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {showNoti && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-7 z-50 w-80 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
                  >
                    <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Thông báo</p>
                      {unreadNotis > 0 && (
                        <button
                          onClick={async () => {
                            await api.put("/notifications/read-all").catch(() => {});
                            fetchNotis();
                          }}
                          className="text-[10px] text-orange-500 hover:text-orange-700 font-semibold"
                        >
                          Đọc tất cả
                        </button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notis.length ? notis.map((n) => (
                        <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-gray-50 hover:bg-orange-50 transition-colors ${!n.is_read ? "bg-orange-50/50" : ""}`}>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm">🔔</div>
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                            {n.message && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{n.message}</p>}
                          </div>
                        </div>
                      )) : (
                        <div className="flex flex-col items-center py-8 text-gray-400">
                          <span className="text-3xl mb-2">🔕</span>
                          <p className="text-xs">Chưa có thông báo</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Chat */}
            <Link to="/chat" className="flex items-center gap-1 text-orange-100 hover:text-white transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
              </svg>
              <span className="hidden sm:inline">Chat</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main bar ── */}
      <div className="bg-gradient-to-r from-[#ee4d2d] via-[#f05226] to-[#ff6b35]">
        <div className="mx-auto grid max-w-7xl grid-cols-12 items-center gap-3 px-4 py-3">
          {/* Logo */}
          <Link to="/" className="col-span-2 flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm text-white font-black text-xl group-hover:bg-white/30 transition-colors">
              S
            </div>
            <span className="text-2xl font-black tracking-tight text-white hidden sm:block">
              Shopee
            </span>
          </Link>

          {/* Search */}
          <div className="col-span-8 relative">
            <div className="flex overflow-hidden rounded-xl bg-white shadow-md ring-2 ring-white/30">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                className="flex-1 px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400"
                placeholder="Tìm sản phẩm, thương hiệu, danh mục..."
              />
              <button
                onClick={() => doSearch()}
                className="flex items-center gap-2 bg-[#ee4d2d] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#d94429] transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden sm:inline">Tìm</span>
              </button>
            </div>

            {/* Search dropdown */}
            <AnimatePresence>
              {dropdownItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
                >
                  {dropdownItems.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => doSearch(s.name)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 transition-colors"
                    >
                      <span className="text-gray-400">{s.isHistory ? "🕐" : "🔍"}</span>
                      {s.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Cart & User */}
          <div className="col-span-2 flex items-center justify-end gap-3">
            {/* Cart */}
            <Link to="/cart" className="relative flex flex-col items-center gap-0.5 text-white hover:text-orange-100 transition-colors">
              <div className="relative">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 1.5 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-black text-gray-900"
                  >
                    {cartCount > 99 ? "99+" : cartCount}
                  </motion.span>
                )}
              </div>
              <span className="text-[10px] font-medium hidden sm:block">Giỏ hàng</span>
            </Link>
          </div>
        </div>

        {/* ── Sub nav ── */}
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 pb-2.5">
          {/* Popular keywords */}
          <div className="flex items-center gap-1 flex-wrap">
            {popular.slice(0, 5).map((kw) => (
              <button
                key={kw}
                onClick={() => doSearch(kw)}
                className="rounded-full px-3 py-0.5 text-xs text-orange-100 hover:bg-white/20 hover:text-white transition-all"
              >
                {kw}
              </button>
            ))}
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            <NavLink to="/products" icon="🛍️" label="Sản phẩm" />
            <NavLink to="/wishlist" icon="❤️" label={`Yêu thích${wishlistCount > 0 ? ` (${wishlistCount})` : ""}`} />
            {(user?.role === "admin" || user?.role === "staff") && (
              <NavLink to="/admin" icon="⚙️" label="Admin" highlight />
            )}

            {/* User menu */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => { setShowUserMenu((s) => !s); setShowNoti(false); }}
                  className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/30 text-xs font-black">
                    {user.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <span className="max-w-[80px] truncate hidden sm:block">{user.name}</span>
                  <svg className="h-3 w-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-10 z-50 w-52 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
                    >
                      <div className="border-b border-gray-100 px-4 py-3">
                        <p className="text-xs font-bold text-gray-800">{user.name}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                      {[
                        { to: "/profile", icon: "👤", label: "Tài khoản của tôi" },
                        { to: "/orders/my", icon: "📦", label: "Đơn mua" },
                        { to: "/wishlist", icon: "❤️", label: "Yêu thích" },
                      ].map(({ to, icon, label }) => (
                        <Link
                          key={to}
                          to={to}
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 transition-colors"
                        >
                          <span>{icon}</span>
                          {label}
                        </Link>
                      ))}
                      <div className="border-t border-gray-100">
                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <span>🚪</span>
                          Đăng xuất
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Link to="/register" className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors">
                  Đăng ký
                </Link>
                <span className="text-white/40">|</span>
                <Link to="/login" className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors">
                  Đăng nhập
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, icon, label, highlight }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all
        ${highlight
          ? "bg-yellow-400 text-gray-900 hover:bg-yellow-300"
          : "text-white hover:bg-white/20"
        }`}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}