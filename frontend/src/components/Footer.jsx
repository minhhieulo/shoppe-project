import { Link } from "react-router-dom";

const FOOTER_LINKS = [
  {
    title: "Chăm sóc khách hàng",
    links: [
      { label: "Trung tâm trợ giúp", href: "#" },
      { label: "Hướng dẫn mua hàng", href: "#" },
      { label: "Hướng dẫn bán hàng", href: "#" },
      { label: "Thanh toán", href: "#" },
      { label: "Shopee Xu & Xu", href: "#" },
      { label: "Vận chuyển", href: "#" },
      { label: "Trả hàng & Hoàn tiền", href: "#" },
    ],
  },
  {
    title: "Về Shopee",
    links: [
      { label: "Giới thiệu về Shopee", href: "#" },
      { label: "Tuyển dụng", href: "#" },
      { label: "Chính sách bảo mật", href: "#" },
      { label: "Điều khoản Shopee", href: "#" },
      { label: "Flash Sale", href: "/products?flashSale=true" },
      { label: "Kênh người bán", href: "#" },
      { label: "Blog", href: "#" },
    ],
  },
  {
    title: "Thanh toán",
    icons: [
      { label: "Visa", bg: "bg-blue-600", text: "VISA", textColor: "text-white" },
      { label: "Mastercard", bg: "bg-red-500", text: "MC", textColor: "text-white" },
      { label: "Momo", bg: "bg-pink-500", text: "MoMo", textColor: "text-white" },
      { label: "ZaloPay", bg: "bg-blue-500", text: "ZaloPay", textColor: "text-white" },
      { label: "VNPay", bg: "bg-red-600", text: "VNPay", textColor: "text-white" },
      { label: "COD", bg: "bg-green-600", text: "COD", textColor: "text-white" },
    ],
  },
  {
    title: "Đơn vị vận chuyển",
    icons: [
      { label: "GHN", bg: "bg-red-500", text: "GHN", textColor: "text-white" },
      { label: "GHTK", bg: "bg-green-600", text: "GHTK", textColor: "text-white" },
      { label: "ViettelPost", bg: "bg-red-700", text: "Viettel", textColor: "text-white" },
      { label: "VNPost", bg: "bg-yellow-500", text: "VNPost", textColor: "text-gray-900" },
      { label: "Ninja Van", bg: "bg-red-400", text: "Ninja", textColor: "text-white" },
      { label: "JT", bg: "bg-red-600", text: "J&T", textColor: "text-white" },
    ],
  },
];

const SOCIAL = [
  { label: "Facebook", icon: "f", href: "#", color: "bg-[#1877F2]" },
  { label: "Instagram", icon: "in", href: "#", color: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400" },
  { label: "TikTok", icon: "tt", href: "#", color: "bg-black" },
  { label: "YouTube", icon: "▶", href: "#", color: "bg-red-600" },
  { label: "Zalo", icon: "z", href: "#", color: "bg-blue-500" },
];

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-8">

      {/* ── App Download Banner ── */}
      <div className="bg-gradient-to-r from-[#ee4d2d] to-[#ff6b35] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row">
          <div>
            <p className="text-lg font-black">TẢI ỨNG DỤNG SHOPEE NGAY!</p>
            <p className="text-sm text-orange-100 mt-0.5">Nhận mã giảm giá 30% cho đơn đầu tiên</p>
          </div>
          <div className="flex items-center gap-3">
            {/* QR placeholder */}
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white p-1.5">
              <div className="grid grid-cols-5 gap-0.5 w-full h-full">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-[1px] ${
                      [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24,6,12,18].includes(i)
                        ? "bg-gray-900" : "bg-white"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <a href="#" className="flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 text-sm font-semibold backdrop-blur-sm">
                <span>🍎</span> App Store
              </a>
              <a href="#" className="flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 text-sm font-semibold backdrop-blur-sm">
                <span>🤖</span> Google Play
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main footer ── */}
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">

          {/* Links columns */}
          {FOOTER_LINKS.slice(0, 2).map((col) => (
            <div key={col.title}>
              <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-gray-500">
                {col.title}
              </h3>
              <ul className="space-y-2.5">
                {col.links?.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-sm text-gray-500 hover:text-[#ee4d2d] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Payment icons */}
          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-gray-500">
              Phương thức thanh toán
            </h3>
            <div className="flex flex-wrap gap-2">
              {FOOTER_LINKS[2].icons.map((ic) => (
                <div
                  key={ic.label}
                  className={`flex h-8 items-center justify-center rounded-lg ${ic.bg} px-2.5`}
                  title={ic.label}
                >
                  <span className={`text-xs font-black ${ic.textColor}`}>{ic.text}</span>
                </div>
              ))}
            </div>

            <h3 className="mb-3 mt-6 text-xs font-black uppercase tracking-widest text-gray-500">
              Đơn vị vận chuyển
            </h3>
            <div className="flex flex-wrap gap-2">
              {FOOTER_LINKS[3].icons.map((ic) => (
                <div
                  key={ic.label}
                  className={`flex h-8 items-center justify-center rounded-lg ${ic.bg} px-2.5`}
                  title={ic.label}
                >
                  <span className={`text-xs font-black ${ic.textColor}`}>{ic.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Social & App */}
          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-gray-500">
              Theo dõi chúng tôi
            </h3>
            <div className="flex flex-col gap-2.5">
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:border-orange-300 hover:text-[#ee4d2d] transition-all shadow-sm hover:shadow"
                >
                  <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${s.color} text-xs font-black text-white`}>
                    {s.icon}
                  </div>
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-8 px-4 py-6 text-center">
          {[
            { value: "10M+", label: "Sản phẩm" },
            { value: "2M+", label: "Khách hàng" },
            { value: "500K+", label: "Người bán" },
            { value: "63", label: "Tỉnh thành" },
            { value: "24/7", label: "Hỗ trợ" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center">
              <span className="text-2xl font-black text-[#ee4d2d]">{value}</span>
              <span className="text-xs text-gray-500 mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between">
            <p className="text-xs text-gray-400">
              © 2024 Shopee Clone. Tất cả các quyền được bảo lưu.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
              {["Chính sách bảo mật", "Quy chế hoạt động", "Chính sách vận chuyển", "Chính sách trả hàng"].map((t) => (
                <a key={t} href="#" className="hover:text-[#ee4d2d] transition-colors">{t}</a>
              ))}
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-gray-300">
            Địa chỉ: Tầng 4-5, Tòa nhà Capital Place, 29 Liễu Giai, Ba Đình, Hà Nội · MST: 0106773786
          </p>
        </div>
      </div>
    </footer>
  );
}