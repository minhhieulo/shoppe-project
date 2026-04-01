import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../store/useStore";

export default function CartFlyEffect() {
  const flyToCart = useStore((s) => s.flyToCart);
  if (!flyToCart) return null;
  const { x, y } = flyToCart;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ x, y, opacity: 1, scale: 1 }}
        animate={{ x: window.innerWidth - 24, y: 28, opacity: 0.2, scale: 0.3 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.65, ease: "easeInOut" }}
        className="pointer-events-none fixed z-[80] h-5 w-5 rounded-full bg-[#ee4d2d]"
      />
    </AnimatePresence>
  );
}
