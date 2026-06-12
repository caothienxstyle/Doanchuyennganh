import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, User, Lock, ShieldAlert, Loader2 } from "lucide-react";
import axios from "axios";

import AuthLayout from "../layouts/AuthLayout";
import { getHomeForRole, normalizeUserSession } from "../services/auth";


export default function LoginPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!username.trim() || !password.trim()) {
      setErrorMsg("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }

    try {
      setLoading(true);

      const res = await axios.post(
        "http://localhost:3000/auth/login",
        {
          username: username.trim(),
          password: password,
        }
      );

      console.log(res.data);

      const { token, user } = res.data;

      // 🛡️ LỚP BẢO MẬT: Kiểm tra trạng thái tài khoản
      const status = user.TrangThai ?? user.TrangThaiTaiKhoan;
      if (status !== undefined && Number(status) === 0) {
        setErrorMsg("Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ quản trị viên.");
        setLoading(false);
        return;
      }

      // Lưu token
      localStorage.setItem("token", token);

      // Lưu thông tin user đã chuẩn hóa
      const normalizedUser = normalizeUserSession(user);
      localStorage.setItem("user", JSON.stringify(normalizedUser));

      // Chuyển trang theo role
      navigate(
        getHomeForRole(user.role),
        {
          replace: true,
        }
      );

    } catch (error) {
      console.log(error);
      const message = error.response?.data?.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      {/* LEFT PANEL (60% width on desktop) */}
      <div className="w-full md:w-[60%] relative flex flex-col justify-between p-8 sm:p-12 md:p-14 lg:p-16 text-white min-h-[450px] md:min-h-0">
        {/* Background Image Container */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/kho.png" 
            alt="Warehouse Management System" 
            className="w-full h-full object-cover"
          />
          {/* Dark blue gradient overlay with backdrop blur */}
         <div className="absolute inset-0 bg-[#0b2f6a]/1" />
         <div className="absolute inset-0 bg-gradient-to-r from-[#0b2f6a]/90 via-[#0b2f6a]/45" />
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 h-full flex flex-col justify-between gap-12">
          {/* Logo - Top Left */}
          <div>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl rounded-2xl bg-[#0b3c6d]/80 backdrop-blur-md border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
          </div>

          {/* Title and Subtitle - Middle */}
          <div className="my-auto">
            <h1 className="text-[56px] leading-[1.05] font-extrabold font-bold tracking-tight text-white leading-[1.15] select-none">
              Warehouse<br />
              Management System
            </h1>
            <p className="text-sm lg:text-base text-blue-200/110 font-bold leading-relaxed font-normal mt-10 max-w-md">
              Quản lý kho hàng hiệu quả,<br />
              tối ưu hoạt động doanh nghiệp.
            </p>
          </div>

          {/* Floating Glassmorphism Card - Bottom Left */}
          <div className="backdrop-blur-md bg-white/10 rounded-[24px] p-5 sm:p-6 border border-white/15 flex items-start gap-4 p-7 rounded-[28px] shadow-[0_12px_36px_rgba(0,0,0,0.25)] mt-auto">
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#2563eb] flex items-center justify-center text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                Hiệu quả hơn mỗi ngày
              </h3>
              <p className="text-xs text-blue-100/90 leading-normal font-medium">
                Tối ưu quy trình – Kiểm soát tồn kho – Nâng cao hiệu suất
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL (40% width on desktop) */}
      <div className="w-full md:w-[40%] bg-white flex flex-col justify-center items-center p-8 sm:p-12 md:p-10 lg:p-12 xl:p-16 min-h-[500px] md:min-h-0">
        <div className="w-full max-w-[360px] flex flex-col items-center">
          {/* Header Icon */}
          <div className="w-[72px] h-[72px] rounded-full bg-[#eff6ff] flex items-center justify-center mb-6">
            <Lock className="w-7 h-7 text-[#2563eb]" strokeWidth={2} />
          </div>

          {/* Heading */}
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight text-center mb-2">
            Chào mừng trở lại!
          </h2>
          <p className="text-sm text-gray-400 font-medium text-center mb-8">
            Đăng nhập để tiếp tục quản lý kho hàng
          </p>

          {/* Error Message Container */}
          {errorMsg && (
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm mb-6 w-full animate-shake">
              <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="font-medium">{errorMsg}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-5">
            {/* Username Field */}
            <div>
              <label className="text-[12px] font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                Tên đăng nhập
              </label>
              <div className="relative flex items-center border border-gray-200 rounded-[16px] bg-[#fbfbfb] hover:bg-white focus-within:bg-white transition-all focus-within:border-[#2563eb] focus-within:ring-4 focus-within:ring-[#2563eb]/10 overflow-hidden">
                <User size={20} className="absolute left-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 text-sm text-gray-900 placeholder-gray-400 outline-none border-none bg-transparent font-medium"
                  placeholder="Nhập tên đăng nhập"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="text-[12px] font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                Mật khẩu
              </label>
              <div className="relative flex items-center border border-gray-200 rounded-[16px] bg-[#fbfbfb] hover:bg-white focus-within:bg-white transition-all focus-within:border-[#2563eb] focus-within:ring-4 focus-within:ring-[#2563eb]/10 overflow-hidden">
                <Lock size={20} className="absolute left-4 text-gray-400 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 text-sm text-gray-900 placeholder-gray-400 outline-none border-none bg-transparent font-medium"
                  placeholder="Nhập mật khẩu"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center mt-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded-md border-gray-300 text-[#2563eb] focus:ring-[#2563eb] focus:ring-offset-0 transition-colors cursor-pointer"
                />
                <span className="text-sm text-gray-700 font-medium">Ghi nhớ đăng nhập</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] text-white font-semibold py-4 rounded-[16px] transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-600/20 disabled:opacity-50 disabled:pointer-events-none text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <span>Đăng nhập</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
}