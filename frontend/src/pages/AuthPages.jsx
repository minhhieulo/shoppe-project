import { useEffect, useRef, useState, forwardRef } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import api from "../services/api";
import { useStore } from "../store/useStore";

// ─── Yup schemas ──────────────────────────────────────────────────────────────

const loginSchema = yup.object({
  email:    yup.string().email("Email không hợp lệ").required("Email bắt buộc"),
  password: yup.string().min(6, "Tối thiểu 6 ký tự").required("Mật khẩu bắt buộc"),
});

const registerSchema = yup.object({
  name:     yup.string().min(2, "Tối thiểu 2 ký tự").required("Tên bắt buộc"),
  email:    yup.string().email("Email không hợp lệ").required("Email bắt buộc"),
  password: yup.string().min(6, "Tối thiểu 6 ký tự").required("Mật khẩu bắt buộc"),
});

const phoneSchema = yup.object({
  phone: yup
    .string()
    .matches(/^(0|\+84)[3-9]\d{8}$/, "SĐT không hợp lệ (VD: 0912345678)")
    .required("SĐT bắt buộc"),
});

// ─── Shared UI ────────────────────────────────────────────────────────────────

function AuthBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-orange-200/50 to-red-200/30 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-red-200/40 to-pink-200/20 blur-3xl" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-amber-100/30 blur-2xl" />
      {/* Floating shapes */}
      <div className="absolute top-20 left-10 h-8 w-8 rounded-lg bg-orange-300/20 rotate-12" />
      <div className="absolute top-40 right-20 h-5 w-5 rounded-full bg-red-300/30" />
      <div className="absolute bottom-32 left-1/4 h-6 w-6 rounded-lg bg-orange-200/25 -rotate-6" />
    </div>
  );
}

const AuthInput = forwardRef(function AuthInput({ error, icon, ...props }, ref) {
  return (
    <div className="relative">
      {icon && (
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm select-none pointer-events-none">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={`w-full rounded-xl border-2 bg-gray-50/80 py-3 text-sm outline-none transition-all
          ${icon ? "pl-10 pr-4" : "px-4"}
          ${error
            ? "border-red-300 bg-red-50/80 focus:border-red-400 focus:ring-4 focus:ring-red-100"
            : "border-gray-100 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100/60"
          }`}
        {...props}
      />
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
          <span>⚠️</span> {error}
        </p>
      )}
    </div>
  );
});

function Divider({ text = "hoặc tiếp tục bằng" }) {
  return (
    <div className="relative my-5 flex items-center">
      <div className="flex-1 border-t border-gray-200" />
      <span className="mx-3 whitespace-nowrap text-xs text-gray-400">{text}</span>
      <div className="flex-1 border-t border-gray-200" />
    </div>
  );
}

function OrangeBtn({ loading, children, ...props }) {
  return (
    <button
      {...props}
      className="w-full rounded-xl bg-gradient-to-r from-[#ee4d2d] to-[#ff6b35] py-3 text-sm font-bold text-white shadow-lg shadow-orange-200/60 transition-all hover:shadow-xl hover:shadow-orange-300/50 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 disabled:translate-y-0"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          {children}
        </span>
      ) : children}
    </button>
  );
}

// ─── OTP — 6 ô tách biệt ─────────────────────────────────────────────────────

function OTPInput({ value, onChange }) {
  const refs = useRef([]);
  const digits = (value + "      ").slice(0, 6).split("");

  const update = (idx, char) => {
    const next = digits.map((d, i) => (i === idx ? char : d));
    onChange(next.join("").trimEnd());
  };

  const handleChange = (e, idx) => {
    const ch = e.target.value.replace(/\D/g, "").slice(-1);
    update(idx, ch);
    if (ch && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === "Backspace") {
      update(idx, " ");
      if (!digits[idx].trim() && idx > 0) refs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
    e.preventDefault();
  };

  return (
    <div className="flex justify-center gap-2">
      {digits.map((d, idx) => (
        <input
          key={idx}
          ref={(el) => (refs.current[idx] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          onChange={(e) => handleChange(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          onPaste={handlePaste}
          className={`h-12 w-10 rounded-xl border-2 text-center text-lg font-bold outline-none transition-all
            ${d.trim()
              ? "border-orange-400 bg-orange-50 text-orange-600"
              : "border-gray-200 bg-gray-50 text-gray-700"
            } focus:border-orange-500 focus:ring-2 focus:ring-orange-100`}
        />
      ))}
    </div>
  );
}

// ─── Phone login flow ─────────────────────────────────────────────────────────

function PhoneLoginForm({ onSuccess }) {
  const {
    register, handleSubmit, getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: yupResolver(phoneSchema) });
  const [step, setStep]         = useState("phone");
  const [otp, setOtp]           = useState("");
  const [countdown, setCountdown] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const { notify } = useStore();

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const doSend = async ({ phone }) => {
    try {
      const { data } = await api.post("/auth/send-otp", { phone });
      notify(data.otp ? `OTP (dev): ${data.otp}` : "Đã gửi OTP đến SĐT");
      setStep("otp");
      setCountdown(60);
      setOtp("");
    } catch (err) {
      notify(err.response?.data?.message || "Gửi OTP thất bại", "error");
    }
  };

  const doVerify = async () => {
    const code = otp.replace(/\s/g, "");
    if (code.length !== 6) return notify("Nhập đủ 6 số OTP", "error");
    setVerifying(true);
    try {
      const { data } = await api.post("/auth/verify-otp", {
        phone: getValues("phone"),
        code,
      });
      onSuccess(data);
    } catch (err) {
      notify(err.response?.data?.message || "OTP không đúng", "error");
    } finally {
      setVerifying(false);
    }
  };

  if (step === "otp") {
    return (
      <div className="space-y-5">
        <p className="text-center text-sm text-gray-500">
          Nhập mã 6 số đã gửi đến{" "}
          <span className="font-bold text-gray-800">{getValues("phone")}</span>
        </p>

        <OTPInput value={otp} onChange={setOtp} />

        <OrangeBtn
          onClick={doVerify}
          disabled={verifying || otp.replace(/\s/g, "").length !== 6}
          loading={verifying}
        >
          Xác nhận OTP
        </OrangeBtn>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => { setStep("phone"); setOtp(""); }}
            className="text-gray-400 hover:text-gray-600"
          >
            ← Đổi số điện thoại
          </button>
          <button
            type="button"
            onClick={() => doSend({ phone: getValues("phone") })}
            disabled={countdown > 0}
            className={`font-semibold ${countdown > 0 ? "text-gray-400" : "text-orange-500 hover:text-orange-700"}`}
          >
            {countdown > 0 ? `Gửi lại (${countdown}s)` : "Gửi lại OTP"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(doSend)} className="space-y-4">
      <AuthInput
        placeholder="Số điện thoại (VD: 0912345678)"
        icon="📱"
        type="tel"
        error={errors.phone?.message}
        {...register("phone")}
      />
      <OrangeBtn type="submit" loading={isSubmitting}>
        {isSubmitting ? "Đang gửi..." : "Gửi mã OTP"}
      </OrangeBtn>
    </form>
  );
}

// ─── Social buttons ───────────────────────────────────────────────────────────

const SERVER = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace("/api", "");

function GoogleBtn({ onSuccess }) {
  const { notify } = useStore();

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Lấy thông tin user từ Google
        const { data: profile } = await fetch(
          `https://www.googleapis.com/oauth2/v3/userinfo`,
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        ).then((r) => r.json()).then((d) => ({ data: d }));

        // Redirect sang backend callback để tạo JWT
        // Cách đơn giản nhất: dùng redirect flow
        window.location.href = `${SERVER}/api/auth/google`;
      } catch {
        notify("Đăng nhập Google thất bại", "error");
      }
    },
    onError: () => notify("Đăng nhập Google bị hủy", "error"),
  });

  return (
    <button
      type="button"
      onClick={() => login()}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow active:scale-[0.98]"
    >
      {/* Google logo SVG */}
      <svg className="h-5 w-5" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
        <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
      </svg>
      Tiếp tục với Google
    </button>
  );
}

function FacebookBtn() {
  return (
    <button
      type="button"
      onClick={() => { window.location.href = `${SERVER}/api/auth/facebook`; }}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#1877F2] bg-[#1877F2] py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
    >
      {/* Facebook logo SVG */}
      <svg className="h-5 w-5 fill-white" viewBox="0 0 24 24">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.271h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
      </svg>
      Tiếp tục với Facebook
    </button>
  );
}

function SocialButtons({ onSuccess }) {
  return (
    <div className="space-y-2.5">
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
        <GoogleBtn onSuccess={onSuccess} />
      </GoogleOAuthProvider>
      <FacebookBtn />
    </div>
  );
}

// ─── Brand hero (left panel) ──────────────────────────────────────────────────

function BrandPanel() {
  return (
    <div className="relative hidden md:flex flex-col justify-between bg-gradient-to-br from-[#ff6b35] via-[#ee4d2d] to-[#cc2200] p-10 text-white min-h-[580px]">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
      <div className="absolute -right-8 bottom-0 h-40 w-40 rounded-full bg-orange-300/20" />

      <div className="relative flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-lg font-bold">S</div>
        <div>
          <span className="text-xl font-black tracking-tight">Shopee Clone</span>
          <p className="text-xs text-orange-200">Nền tảng thương mại điện tử</p>
        </div>
      </div>

      <div className="relative space-y-4">
        <h2 className="text-3xl font-black leading-tight">
          Mua sắm thả ga,<br />
          <span className="text-yellow-300">giá tốt mỗi ngày.</span>
        </h2>
        <p className="text-sm leading-relaxed text-orange-100 max-w-xs">
          Hàng triệu sản phẩm chính hãng, giao hàng nhanh toàn quốc, ưu đãi không ngừng.
        </p>
        <div className="flex gap-6 pt-2 text-xs text-orange-200">
          {[["10M+", "Sản phẩm"], ["2M+", "Khách hàng"], ["24/7", "Hỗ trợ"]].map(([n, l]) => (
            <div key={l}>
              <div className="text-xl font-black text-white">{n}</div>
              <div>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative text-xs text-orange-200">
        © 2024 Shopee Clone. All rights reserved.
      </div>
    </div>
  );
}

// ─── LoginPage ────────────────────────────────────────────────────────────────

export function LoginPage() {
  const [tab, setTab] = useState("email");
  const {
    register, handleSubmit, setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: yupResolver(loginSchema) });
  const navigate = useNavigate();
  const { setUser, notify } = useStore();

  const saveAuth = (data) => {
    localStorage.setItem("accessToken",  data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    setUser(data.user);
    notify("Đăng nhập thành công 🎉");
    navigate("/");
  };

  const onEmail = async (values) => {
    try {
      const { data } = await api.post("/auth/login", values);
      saveAuth(data);
    } catch (err) {
      notify(err.response?.data?.message || "Đăng nhập thất bại", "error");
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center py-10 px-4">
      <AuthBackground />

      <div className="relative z-10 w-full max-w-4xl">
        <div className="grid items-stretch overflow-hidden rounded-3xl shadow-2xl md:grid-cols-2">
          <BrandPanel />

          {/* Form panel */}
          <div className="flex flex-col justify-center bg-white p-8 md:p-10 min-h-[580px]">
            <div className="mb-5">
              <h1 className="text-2xl font-black text-gray-900">Chào mừng trở lại 👋</h1>
              <p className="mt-1 text-sm text-gray-500">Đăng nhập để tiếp tục mua sắm</p>
            </div>

            {/* Tab switcher */}
            <div className="mb-5 flex rounded-xl bg-gray-100 p-1">
              {[["email", "✉️ Email"], ["phone", "📱 SĐT"]].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                    tab === id ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Email form */}
            {tab === "email" && (
              <form onSubmit={handleSubmit(onEmail)} className="space-y-4">
                <AuthInput
                  placeholder="Email của bạn"
                  icon="✉️"
                  error={errors.email?.message}
                  {...register("email")}
                />
                <AuthInput
                  type="password"
                  placeholder="Mật khẩu"
                  icon="🔒"
                  error={errors.password?.message}
                  {...register("password")}
                />
                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-orange-500 hover:text-orange-700"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>

                <OrangeBtn type="submit" loading={isSubmitting}>
                  {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
                </OrangeBtn>


              </form>
            )}

            {/* Phone OTP form */}
            {tab === "phone" && <PhoneLoginForm onSuccess={saveAuth} />}

            {/* Social */}
            <Divider />
            <SocialButtons onSuccess={saveAuth} />

            <p className="mt-5 text-center text-sm text-gray-500">
              Chưa có tài khoản?{" "}
              <Link className="font-semibold text-orange-500 hover:text-orange-700" to="/register">
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RegisterPage ─────────────────────────────────────────────────────────────

export function RegisterPage() {
  const {
    register, handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: yupResolver(registerSchema) });
  const navigate = useNavigate();
  const { setUser, notify } = useStore();

  const saveAuth = (data) => {
    localStorage.setItem("accessToken",  data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    setUser(data.user);
    notify("Đăng nhập thành công 🎉");
    navigate("/");
  };

  const onSubmit = async (values) => {
    try {
      await api.post("/auth/register", values);
      notify("Đăng ký thành công 🎉");
      navigate("/login");
    } catch (err) {
      notify(err.response?.data?.message || "Đăng ký thất bại", "error");
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center py-10 px-4">
      <AuthBackground />

      <div className="relative z-10 w-full max-w-4xl">
        <div className="grid items-stretch overflow-hidden rounded-3xl shadow-2xl md:grid-cols-2">

          {/* Brand panel — right side for register */}
          <div className="relative hidden md:flex flex-col justify-between bg-gradient-to-br from-[#ff6b35] via-[#ee4d2d] to-[#cc2200] p-10 text-white min-h-[580px]">
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
            <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
            <div className="absolute -left-8 bottom-0 h-40 w-40 rounded-full bg-orange-300/20" />

            <div className="relative flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-lg font-bold">S</div>
              <div>
                <span className="text-xl font-black tracking-tight">Shopee Clone</span>
                <p className="text-xs text-orange-200">Nền tảng thương mại điện tử</p>
              </div>
            </div>

            <div className="relative space-y-6">
              {[
                { icon: "🎁", title: "Ưu đãi thành viên mới", desc: "Voucher giảm 30% cho đơn đầu tiên" },
                { icon: "🚚", title: "Free Ship toàn quốc", desc: "Miễn phí vận chuyển cho mọi đơn hàng" },
                { icon: "🔒", title: "Bảo mật tuyệt đối", desc: "Thông tin của bạn được mã hóa an toàn" },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-xl">
                    {icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{title}</p>
                    <p className="text-xs text-orange-200 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative text-xs text-orange-200">© 2024 Shopee Clone. All rights reserved.</div>
          </div>

          {/* Form panel */}
          <div className="flex flex-col justify-center bg-white p-8 md:p-10 min-h-[580px]">
            <div className="mb-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 text-xl shadow-lg shadow-orange-200">
                🛍️
              </div>
              <h1 className="text-2xl font-black text-gray-900">Tạo tài khoản</h1>
              <p className="mt-1 text-sm text-gray-500">Gia nhập cộng đồng mua sắm Shopee</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <AuthInput
                placeholder="Họ và tên"
                icon="👤"
                error={errors.name?.message}
                {...register("name")}
              />
              <AuthInput
                placeholder="Email"
                icon="✉️"
                error={errors.email?.message}
                {...register("email")}
              />
              <AuthInput
                type="password"
                placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                icon="🔒"
                error={errors.password?.message}
                {...register("password")}
              />
              <OrangeBtn type="submit" loading={isSubmitting}>
                {isSubmitting ? "Đang tạo tài khoản..." : "Đăng ký miễn phí 🎉"}
              </OrangeBtn>
            </form>

            <Divider text="hoặc đăng ký nhanh bằng" />
            <SocialButtons onSuccess={saveAuth} />

            <p className="mt-5 text-center text-sm text-gray-500">
              Đã có tài khoản?{" "}
              <Link className="font-semibold text-orange-500 hover:text-orange-700" to="/login">
                Đăng nhập ngay
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── OAuthCallbackPage ────────────────────────────────────────────────────────
// Route: <Route path="/oauth-callback" element={<OAuthCallbackPage />} />

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { setUser, notify } = useStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken  = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    const error        = params.get("error");

    if (error || !accessToken) {
      notify(`Đăng nhập ${error || "social"} thất bại`, "error");
      navigate("/login");
      return;
    }

    localStorage.setItem("accessToken",  accessToken);
    localStorage.setItem("refreshToken", refreshToken);

    api.get("/auth/me")
      .then(({ data }) => {
        setUser(data);
        notify("Đăng nhập thành công 🎉");
        navigate("/");
      })
      .catch(() => navigate("/login"));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-orange-50">
      <div className="text-center space-y-3">
        <svg className="mx-auto h-10 w-10 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <p className="text-sm text-gray-500">Đang xử lý đăng nhập...</p>
      </div>
    </div>
  );
}

// ─── ForgotPasswordPage ───────────────────────────────────────────────────────

export function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm();
  const notify = useStore((s) => s.notify);

  const onSubmit = async (values) => {
    try {
      const { data } = await api.post("/auth/forgot-password", values);
      notify(`Token reset (dev): ${data.resetToken || "đã gửi email"}`);
    } catch (err) {
      notify(err.response?.data?.message || "Thất bại", "error");
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center px-4">
      <AuthBackground />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="h-2 bg-gradient-to-r from-orange-400 to-red-500" />
        <div className="p-8">
          <Link to="/login" className="text-xs text-gray-400 hover:text-orange-500">
            ← Quay lại đăng nhập
          </Link>
          <h1 className="mt-3 text-2xl font-black text-gray-900">Quên mật khẩu</h1>
          <p className="mb-6 mt-1 text-sm text-gray-500">Nhập email để nhận link đặt lại mật khẩu</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <AuthInput placeholder="Email đăng ký" icon="✉️" {...register("email")} />
            <OrangeBtn type="submit" loading={isSubmitting}>
              {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
            </OrangeBtn>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── ResetPasswordPage ────────────────────────────────────────────────────────

export function ResetPasswordPage() {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm();
  const notify = useStore((s) => s.notify);

  const onSubmit = async (values) => {
    try {
      await api.post("/auth/reset-password", values);
      notify("Đặt lại mật khẩu thành công 🎉");
    } catch (err) {
      notify(err.response?.data?.message || "Thất bại", "error");
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center px-4">
      <AuthBackground />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="h-2 bg-gradient-to-r from-orange-400 to-red-500" />
        <div className="p-8">
          <h1 className="mb-1 text-2xl font-black text-gray-900">Đặt lại mật khẩu</h1>
          <p className="mb-6 text-sm text-gray-500">Nhập token và mật khẩu mới của bạn</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <AuthInput placeholder="Reset token" icon="🔑" {...register("token")} />
            <AuthInput type="password" placeholder="Mật khẩu mới" icon="🔒" {...register("newPassword")} />
            <OrangeBtn type="submit" loading={isSubmitting}>
              {isSubmitting ? "Đang đổi..." : "Đổi mật khẩu"}
            </OrangeBtn>
          </form>
        </div>
      </div>
    </div>
  );
}