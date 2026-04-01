import { Link, useLocation } from "react-router-dom";

const items = [
  { to: "/", label: "Home" },
  { to: "/products", label: "Mall" },
  { to: "/cart", label: "Cart" },
  { to: "/notifications", label: "Bell" },
  { to: "/profile", label: "Me" }
];

export default function MobileBottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e5e5e5] bg-white md:hidden">
      <div className="grid grid-cols-5">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`px-2 py-2 text-center text-xs ${pathname === item.to ? "text-[#ee4d2d]" : "text-slate-500"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
