import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../services/api";

export default function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("loading"); // loading | success | failed
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    const resultCode = params.get("resultCode");
    const extraData  = params.get("extraData");
    const momoOrderId = params.get("orderId"); // dạng ORDER-123-timestamp

    // Lấy orderId thật từ extraData (base64) hoặc từ momoOrderId
    let realOrderId = null;
    try {
      if (extraData) {
        const decoded = JSON.parse(atob(extraData));
        realOrderId = decoded.orderId;
      }
    } catch {}

    if (!realOrderId && momoOrderId) {
      const match = String(momoOrderId).match(/^ORDER-(\d+)-/);
      if (match) realOrderId = Number(match[1]);
    }

    setOrderId(realOrderId);

    // Wrap async logic vào inner function — useEffect không được async trực tiếp
    const confirm = async () => {
      if (realOrderId) {
        try {
          const res = await api.post("/payment/momo/confirm", {
            orderId: realOrderId,
            resultCode,
            extraData,
            momoOrderId,
          });
          if (res.data?.payment_status === "paid") {
            setStatus("success");
          } else {
            setStatus("failed");
          }
        } catch {
          // Nếu confirm lỗi, fallback về resultCode từ MoMo
          setStatus(String(resultCode) === "0" ? "success" : "failed");
        }
      } else {
        // Không có orderId — dùng resultCode làm fallback
        setStatus(String(resultCode) === "0" ? "success" : "failed");
      }
    };

    confirm();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="text-gray-500">Đang xác nhận thanh toán...</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          {/* Icon thành công */}
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="mb-2 text-2xl font-black text-gray-900">Thanh toán thành công!</h1>
          <p className="mb-1 text-gray-500">
            Đơn hàng của bạn đã được xác nhận
          </p>
          {orderId && (
            <p className="mb-6 text-sm text-gray-400">Mã đơn hàng: <span className="font-bold text-gray-700">#{orderId}</span></p>
          )}

          {/* MoMo badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2">
            <span className="text-lg">🟣</span>
            <span className="text-sm font-semibold text-purple-700">Thanh toán qua MoMo</span>
          </div>

          <div className="flex flex-col gap-3">
            {orderId && (
              <Link
                to={`/orders/${orderId}`}
                className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
              >
                Xem đơn hàng
              </Link>
            )}
            <Link
              to="/"
              className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Tiếp tục mua sắm
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // failed
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <svg className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="mb-2 text-2xl font-black text-gray-900">Thanh toán thất bại</h1>
        <p className="mb-6 text-gray-500">Giao dịch đã bị hủy hoặc xảy ra lỗi. Đơn hàng của bạn chưa được thanh toán.</p>

        <div className="flex flex-col gap-3">
          {orderId && (
            <Link
              to={`/orders/${orderId}`}
              className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
            >
              Xem đơn hàng (chưa thanh toán)
            </Link>
          )}
          <Link
            to="/checkout"
            className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Thử lại
          </Link>
        </div>
      </div>
    </div>
  );
}