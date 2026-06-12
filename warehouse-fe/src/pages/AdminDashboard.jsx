import { Users, Shield, Package, FolderTree, History } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import MainLayout from "../layouts/MainLayout";
import DashboardGreeting from "../components/DashboardGreeting";
import StatCard from "../components/StatCard";
import DataTable from "../components/DataTable";
import { ROLES, normalizeUserSession } from "../services/auth";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);

  const [newUsers, setNewUsers] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🛡️ Quản lý thông tin người dùng hiện tại
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        return normalizeUserSession(JSON.parse(savedUser));
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const getToken = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";

  const fetchDashboardData = async () => {
    setLoading(true);
    setError("");
    const token = getToken();
    if (!token) {
      setError("Không tìm thấy token xác thực. Vui lòng đăng nhập lại.");
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [
        usersRes,
        productsRes,
        categoriesRes,
        logsRes,
      ] = await Promise.all([
        axios.get("http://localhost:3000/taikhoan/danhsach", { headers }),
        axios.get("http://localhost:3000/products/danhsachsanpham", { headers }),
        axios.get("http://localhost:3000/danhmuc/danhsach", { headers }),
        axios.get("http://localhost:3000/logs?soLuong=20", { headers }), // Lấy dôi ra tí để lọc bản ghi chất lượng
      ]);

      // 1. Xử lý dữ liệu Người dùng
      const allUsers = usersRes.data?.data || [];
      const userCount = usersRes.data?.phanTrang?.tongSo || allUsers.length;
      setTotalUsers(userCount);
      setNewUsers(allUsers.slice(0, 5)); 

      // 2. Xử lý dữ liệu Sản phẩm
      const allProducts = Array.isArray(productsRes.data) ? productsRes.data : (productsRes.data?.data || []);
      setTotalProducts(allProducts.length);
      const lowStock = allProducts.filter(
        (p) => (p.SoLuongTon ?? 0) <= (p.SoLuongToiThieu ?? 0)
      );
      setLowStockProducts(lowStock.slice(0, 5)); 

      // 3. Xử lý dữ liệu Danh mục
      const allCategories = categoriesRes.data?.data || [];
      setTotalCategories(allCategories.length);

      // 4. 🌟 FIX LỖI: Cấu trúc bóc tách dữ liệu Logs chính xác từ API của bạn
      const rawLogs = logsRes.data?.data?.logs || logsRes.data?.logs || [];
      const logCount = logsRes.data?.data?.phanTrang?.tongSo || logsRes.data?.phanTrang?.tongSo || rawLogs.length;
      setTotalLogs(logCount);

      // Lọc bỏ bớt các log VIEW/XEM để Dashboard hiển thị các thao tác nghiệp vụ quan trọng (Thêm/Sửa/Xóa)
      const filteredLogs = rawLogs.filter(log => {
        const act = log.HanhDong?.toLowerCase() || "";
        return !act.includes("view") && !act.includes("xem");
      });
      setSystemLogs(filteredLogs.slice(0, 5));

    } catch (err) {
      console.error("Lỗi tải dữ liệu dashboard:", err);
      setError(err.response?.data?.message || err.message || "Không thể tải dữ liệu dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const syncUser = () => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setCurrentUser(normalizeUserSession(JSON.parse(savedUser)));
      } catch (e) {
        console.error("Lỗi sync user tại AdminDashboard:", e);
      }
    }
  };

  useEffect(() => {
    syncUser();
    fetchDashboardData();

    // Lắng nghe sự kiện để cập nhật Header/Dashboard ngay lập tức khi profile thay đổi
    window.addEventListener("user-updated", syncUser);
    return () => window.removeEventListener("user-updated", syncUser);
  }, []);

  return (
    <MainLayout role={ROLES.admin}>
      <DashboardGreeting
        role={ROLES.admin}
        userName={currentUser?.TenNhanVien}
        description="Quản trị người dùng, phân quyền, hệ thống và dữ liệu"
      />
      
      {loading && <p className="text-sm text-gray-500 animate-pulse my-4">Đang tải dữ liệu tổng quan...</p>}
      {error && <p className="text-sm text-red-500 mb-4 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}

      {/* 🌟 FIX LỖI: Bọc điều kiện hiển thị bằng Fragment chuẩn và đóng tag hợp lệ */}
      {!loading && !error && (
        <>
          {/* Khối thẻ thống kê nhanh */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard title="Người dùng" value={totalUsers} note="Tổng số tài khoản" icon={Users} color="purple" />
            <StatCard title="Sản phẩm" value={totalProducts} note="Tổng số mặt hàng" icon={Package} color="blue" />
            <StatCard title="Danh mục" value={totalCategories} note="Tổng số danh mục" icon={FolderTree} color="green" />
            <StatCard title="Nhật ký hệ thống" value={totalLogs} note="Tổng số log" icon={History} color="orange" />
          </div>

          {/* Khối bảng chi tiết hàng 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
              <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">👤 Người dùng mới</h3>
              <DataTable
                columns={[
                  { key: "TenDangNhap", label: "Tên đăng nhập", render: (v) => <span className="font-mono text-xs font-semibold text-gray-700">{v}</span> },
                  { key: "TenNhanVien", label: "Người dùng", render: (v) => <span className="text-xs">{v || "N/A"}</span> },
                  { key: "TenVaiTro", label: "Vai trò", render: (v) => <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[11px]">{v}</span> },
                  { key: "TrangThai", label: "Trạng thái", render: (v) => <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${Number(v) === 1 || v === true ? "bg-green-50 text-green-600 border-green-100" : "bg-red-50 text-red-600 border-red-100"}`}>{Number(v) === 1 || v === true ? "Hoạt động" : "Bị khóa"}</span> },
                ]}
                data={newUsers}
              />
            </section>

            <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
              <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">⚠️ Sản phẩm sắp hết hàng</h3>
              <DataTable
                columns={[
                  { key: "MaSP", label: "Mã SP", render: (v) => <span className="font-mono text-xs">#{v}</span> },
                  { key: "TenSanPham", label: "Sản phẩm", render: (v) => <span className="text-xs font-medium text-gray-800">{v}</span> },
                  { key: "SoLuongTon", label: "Tồn kho", render: (v) => <span className="font-bold text-red-600 text-xs">{v}</span> },
                  { key: "SoLuongToiThieu", label: "Tối thiểu", render: (v) => <span className="text-xs text-gray-400 font-mono">{v}</span> },
                ]}
                data={lowStockProducts}
              />
            </section>
          </div>

          {/* Khối bảng chi tiết hàng 2 & Thao tác nhanh */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
              <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">📋 Nhật ký hệ thống gần đây</h3>
              <DataTable
                columns={[
                  { key: "TenNhanVien", label: "Người dùng", render: (v, row) => <span className="text-xs font-medium text-gray-700 block max-w-[80px] truncate">{v || row.Email || "Hệ thống"}</span> },
                  { key: "HanhDong", label: "Hành động", render: (v) => <span className="text-[11px] font-semibold text-gray-600 bg-gray-50 border px-1.5 py-0.5 rounded">{v}</span> },
                  { key: "ThoiGian", label: "Thời gian", render: (v) => <span className="text-[11px] text-gray-400 font-mono">{v ? new Date(v).toLocaleTimeString("vi-VN", {hour: '2-digit', minute:'2-digit'}) : "—"}</span> },
                ]}
                data={systemLogs}
              />
            </section>

            <section className="lg:col-span-2 bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
              <h3 className="font-bold text-sm text-gray-700 mb-4">⚡ Thao tác xử lý nhanh</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Quản lý tài khoản", icon: Users, path: "/tk" },
                  { label: "Phân quyền", icon: Shield, path: "/roles" },
                  { label: "Quản lý sản phẩm", icon: Package, path: "/products" },
                  { label: "Danh mục & ĐVT", icon: FolderTree, path: "/categories" },
                  { label: "Lịch sử hệ thống", icon: History, path: "/logs" },
                  { label: "Quản lý nhân sự", icon: Users, path: "/users" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button 
                      key={item.label} 
                      onClick={() => navigate(item.path)}
                      className="rounded-xl bg-gray-50/50 p-4 border border-gray-100 hover:border-blue-500 hover:bg-white hover:shadow-sm transition-all group text-center"
                    >
                      <Icon className="mx-auto mb-2 text-blue-600 group-hover:scale-110 transition-transform w-5 h-5" />
                      <p className="text-xs font-semibold text-gray-700">{item.label}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </>
      )}
    </MainLayout>
  );
}