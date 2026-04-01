import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import {
  CartPage,
  ChatPage,
  CheckoutPage,
  NotificationPage,
  OrderHistoryPage,
  ProfilePage,
  WishlistPage
} from "../pages/UserPages";
import { useStore } from "../store/useStore";

const HomePage = lazy(() => import("../pages/HomePage"));
const ProductListPage = lazy(() => import("../pages/ProductListPage"));
const ProductDetailPage = lazy(() => import("../pages/ProductDetailPage"));
const OrderDetailPage = lazy(() => import("../pages/OrderDetailPage"));
const AdminPanelPage = lazy(() => import("../pages/admin/AdminPanelPage"));
const LoginPage = lazy(() => import("../pages/AuthPages").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("../pages/AuthPages").then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import("../pages/AuthPages").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("../pages/AuthPages").then((m) => ({ default: m.ResetPasswordPage })));
const OAuthCallbackPage = lazy(() => import("../pages/AuthPages").then((m) => ({ default: m.OAuthCallbackPage })));

const Loading = () => <div className="p-4">Loading...</div>;

// ✅ Guard dùng token thay vì chờ user từ store — tránh redirect sai khi refresh
function Guard({ children, roles }) {
  const user = useStore((s) => s.user);
  const hasToken = !!localStorage.getItem("accessToken");

  // Nếu không có token → chắc chắn chưa đăng nhập
  if (!hasToken) return <Navigate to="/login" replace />;

  // Có token nhưng store chưa load user (đang fetch /auth/me) → chờ
  if (!user) return <Loading />;

  // Kiểm tra role nếu cần
  if (roles?.length && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Suspense fallback={<Loading />}><HomePage /></Suspense>} />
        <Route path="/products" element={<Suspense fallback={<Loading />}><ProductListPage /></Suspense>} />
        <Route path="/products/:id" element={<Suspense fallback={<Loading />}><ProductDetailPage /></Suspense>} />
        <Route path="/cart" element={<Guard><CartPage /></Guard>} />
        <Route path="/wishlist" element={<Guard><WishlistPage /></Guard>} />
        <Route path="/checkout" element={<Guard><CheckoutPage /></Guard>} />
        <Route path="/orders" element={<Guard><OrderHistoryPage /></Guard>} />
        <Route path="/orders/:id" element={<Guard><Suspense fallback={<Loading />}><OrderDetailPage /></Suspense></Guard>} />
        <Route path="/notifications" element={<Guard><NotificationPage /></Guard>} />
        <Route path="/profile" element={<Guard><ProfilePage /></Guard>} />
        <Route path="/chat" element={<Guard><ChatPage /></Guard>} />
        <Route path="/admin" element={<Guard roles={["admin", "staff"]}><Suspense fallback={<Loading />}><AdminPanelPage /></Suspense></Guard>} />
      </Route>
      <Route path="/login" element={<Suspense fallback={<Loading />}><LoginPage /></Suspense>} />
      <Route path="/register" element={<Suspense fallback={<Loading />}><RegisterPage /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={<Loading />}><ForgotPasswordPage /></Suspense>} />
      <Route path="/reset-password" element={<Suspense fallback={<Loading />}><ResetPasswordPage /></Suspense>} />
      <Route path="/oauth-callback" element={<Suspense fallback={<Loading />}><OAuthCallbackPage /></Suspense>} />
    </Routes>
  );
}