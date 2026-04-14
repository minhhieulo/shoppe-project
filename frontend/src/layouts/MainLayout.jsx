import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Toast from "../components/Toast";
import MobileBottomNav from "../components/MobileBottomNav";
import CartFlyEffect from "../components/CartFlyEffect";
import ChatbotWidget from "../components/ChatbotWidget";

export default function MainLayout() {
  return (
    <>
      <Navbar />
      <main className="min-h-[70vh] bg-[#f5f5f5]">
        <Outlet />
      </main>
      <Footer />
      <CartFlyEffect />
      <MobileBottomNav />
      <Toast />
      <ChatbotWidget />
    </>
  );
}