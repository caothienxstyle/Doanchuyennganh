import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import axios from "axios";

import AuthLayout from "../layouts/AuthLayout";
import { getHomeForRole } from "../services/auth";

export default function LoginPage() {

  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {

    e.preventDefault();

    try {

      setLoading(true);

      const res = await axios.post(
        "http://localhost:3000/auth/login",
        {
          username,
          password,
        }
      );

      console.log(res.data);

      const { token, user } = res.data;

      // 🛡️ LỚP BẢO MẬT: Kiểm tra trạng thái tài khoản
      // Dựa trên TaikhoanPage, TrangThai = 1 là Hoạt động, 0 là Bị khóa
      const status = user.TrangThai ?? user.TrangThaiTaiKhoan;
      if (status !== undefined && Number(status) === 0) {
        alert("Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ quản trị viên để mở lại.");
        setLoading(false);
        return;
      }

      // Lưu token
      localStorage.setItem(
        "token",
        token
      );

      // Lưu thông tin user
      localStorage.setItem(
        "user",
        JSON.stringify(user)
      );

      // Chuyển trang theo role
      navigate(
        getHomeForRole(user.role),
        {
          replace: true,
        }
      );

    } catch (error) {

      console.log(error);

      alert(
        error.response?.data?.message ||
        "Đăng nhập thất bại"
      );

    } finally {

      setLoading(false);

    }
  }

  return (
    <AuthLayout>

      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm border border-gray-100">

        <div className="text-center mb-8">

          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl">
            HD
          </div>

          <h1 className="text-2xl font-bold">
            Đăng nhập hệ thống
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Warehouse Management System
          </p>

        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-4"
        >

          <div>

            <label className="text-sm font-medium">
              Tên đăng nhập
            </label>

            <input
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="Nhập username"
            />

          </div>

          <div>

            <label className="text-sm font-medium">
              Mật khẩu
            </label>

            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 outline-none focus:border-blue-500"
                placeholder="Nhập mật khẩu"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>

          </div>

          <button
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold hover:bg-blue-700 disabled:bg-gray-400"
          >

            {loading
              ? "Đang đăng nhập..."
              : "Đăng nhập"}

          </button>

        </form>

      </div>

    </AuthLayout>
  );
}