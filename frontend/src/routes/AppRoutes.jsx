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

const HomePage            = lazy(() => import("../pages/HomePage"));
const ProductListPage     = lazy(() => import("../pages/ProductListPage"));
const ProductDetailPage   = lazy(() => import("../pages/ProductDetailPage"));
const OrderDetailPage     = lazy(() => import("../pages/OrderDetailPage"));
const AdminPanelPage      = lazy(() => import("../pages/admin/AdminPanelPage"));
const CheckoutSuccessPage = lazy(() => import("../pages/CheckoutSuccessPage"));

const LoginPage           = lazy(() => import("../pages/AuthPages").then((m) => ({ default: m.LoginPage })));
const RegisterPage        = lazy(() => import("../pages/AuthPages").then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage  = lazy(() => import("../pages/AuthPages").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage   = lazy(() => import("../pages/AuthPages").then((m) => ({ default: m.ResetPasswordPage })));
const OAuthCallbackPage   = lazy(() => import("../pages/AuthPages").then((m) => ({ default: m.OAuthCallbackPage })));

const Loading = () => (
  <div className="flex min-h-[200px] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
  </div>
);

function Guard({ children, roles }) {
  const user = useStore((s) => s.user);
  const hasToken = !!localStorage.getItem("accessToken");

  if (!hasToken) return <Navigate to="/login" replace />;
  if (!user) return <Loading />;
  if (roles?.length && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}

function S({ children }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Routes có Navbar/Footer */}
      <Route element={<MainLayout />}>
        <Route path="/"             element={<S><HomePage /></S>} />
        <Route path="/products"     element={<S><ProductListPage /></S>} />
        <Route path="/products/:id" element={<S><ProductDetailPage /></S>} />

        <Route path="/cart"          element={<Guard><CartPage /></Guard>} />
        <Route path="/wishlist"      element={<Guard><WishlistPage /></Guard>} />
        <Route path="/checkout"      element={<Guard><CheckoutPage /></Guard>} />
        <Route path="/orders"        element={<Guard><OrderHistoryPage /></Guard>} />
        <Route path="/orders/:id"    element={<Guard><S><OrderDetailPage /></S></Guard>} />
        <Route path="/notifications" element={<Guard><NotificationPage /></Guard>} />
        <Route path="/profile"       element={<Guard><ProfilePage /></Guard>} />
        <Route path="/chat"          element={<Guard><ChatPage /></Guard>} />
        <Route path="/admin"         element={<Guard roles={["admin", "staff"]}><S><AdminPanelPage /></S></Guard>} />
      </Route>

      {/* Routes không có Navbar */}
      <Route path="/login"           element={<S><LoginPage /></S>} />
      <Route path="/register"        element={<S><RegisterPage /></S>} />
      <Route path="/forgot-password" element={<S><ForgotPasswordPage /></S>} />
      <Route path="/reset-password"  element={<S><ResetPasswordPage /></S>} />
      <Route path="/oauth-callback"  element={<S><OAuthCallbackPage /></S>} />

      {/* MoMo / Payment callback */}
      <Route path="/checkout/success" element={<S><CheckoutSuccessPage /></S>} />
    </Routes>
  );
}