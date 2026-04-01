import { useEffect } from "react";
import AppRoutes from "./routes/AppRoutes";
import api from "./services/api";
import { useStore } from "./store/useStore";

export default function App() {
  const setUser = useStore((s) => s.setUser);
  useEffect(() => {
    if (!localStorage.getItem("accessToken")) return;
    api.get("/auth/me").then((res) => setUser(res.data)).catch(() => setUser(null));
  }, [setUser]);
  return <AppRoutes />;
}
