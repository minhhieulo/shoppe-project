import { useStore } from "../store/useStore";

export default function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-slate-900 px-4 py-3 text-white shadow">
      {toast.message}
    </div>
  );
}
