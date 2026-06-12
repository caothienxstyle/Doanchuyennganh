import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Package, FileInput, FileOutput, ClipboardCheck, AlertTriangle,
  LayoutDashboard, Warehouse, FolderTree, MapPin, ShieldCheck, BarChart3, PlusCircle
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import MainLayout from "../layouts/MainLayout";
import DashboardGreeting from "../components/DashboardGreeting";
import StatCard from "../components/StatCard";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { ROLES, normalizeUserSession } from "../services/auth";
import { menuByRole } from "../constants/menu"; // Import menuByRole
import { getProducts } from "../services/productService";
import { getTonKhoItems } from "../services/tonKhoService";

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        return normalizeUserSession(JSON.parse(savedUser));
      } catch (e) {
        console.error("Lỗi đọc dữ liệu người dùng tại StaffDashboard:", e);
      }
    }
    return null;
  });
  const [stats, setStats] = useState({
    totalInventory: 0,
    importsToday: 0,
    exportsToday: 0,
    pendingChecks: 0,
    lowStockCount: 0
  });

  const [chartData, setChartData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [pendingImports, setPendingImports] = useState([]);
  const [lowStockList, setLowStockList] = useState([]);
  const [incidentList, setIncidentList] = useState([]);
  const [logs, setLogs] = useState([]);

  const getToken = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
  const headers = { Authorization: `Bearer ${getToken()}` };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // ✅ Sử dụng allSettled để tránh crash cả trang nếu 1 API bị lỗi (ví dụ: lỗi 403 Forbidden)
      const results = await Promise.allSettled([
        getProducts(),
        getTonKhoItems(),
        axios.get("http://localhost:3000/phieunhap/danhsach", { headers }),
        axios.get("http://localhost:3000/phieuxuat/danhsach", { headers }),
        axios.get("http://localhost:3000/baohanh/danhsach", { headers })
      ]);

      // Helper để trích xuất dữ liệu an toàn từ kết quả allSettled
      const getData = (res, defaultValue = []) => 
        res.status === 'fulfilled' ? (res.value.data?.data || res.value.data || res.value || defaultValue) : defaultValue;

      const products = getData(results[0]);
      const inventory = getData(results[1]);
      const imports = getData(results[2]);
      const exports = getData(results[3]);
      const warranties = getData(results[4]);
      // ❌ Đã loại bỏ logsRes vì nhân viên không có quyền truy cập (Lỗi 403)

      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Tính toán KPIs
      // ✅ Tính tổng sản lượng thực tế từ bảng tồn kho (Inventory)
      const totalQty = inventory.reduce((sum, item) => {
        const raw = item?.data ?? item?.item ?? item ?? {};
        return sum + (Number(raw.SoLuongTon || raw.soLuongTon || 0));
      }, 0);

      const todayImports = imports.filter(p => p.NgayNhap?.startsWith(todayStr)).length;
      const todayExports = exports.filter(p => p.NgayXuat?.startsWith(todayStr)).length;
      const pendingCheck = imports.filter(p => p.TrangThai === "ChoDuyet").length;
      
      // ✅ Map tồn kho vào sản phẩm để tính toán cảnh báo chính xác
      const stockMap = inventory.reduce((acc, item) => {
        const raw = item?.data ?? item?.item ?? item ?? {};
        const pid = raw.MaSanPham || raw.maSanPham;
        acc[pid] = (acc[pid] || 0) + Number(raw.SoLuongTon || raw.soLuongTon || 0);
        return acc;
      }, {});

      const lowStock = products.filter(p => (stockMap[p.id] || 0) <= (Number(p.minQuantity) || 0));
      
      // Chuẩn hóa dữ liệu sản phẩm thấp cấp cho bảng hiển thị
      const normalizedLowStock = lowStock.map(p => ({
        ...p,
        MaSP: p.code || p.MaSP || p.id,
        TenSanPham: p.name || p.TenSanPham,
        SoLuongTon: stockMap[p.id] || 0,
        SoLuongToiThieu: p.minQuantity || p.SoLuongToiThieu || 0
      }));

      setStats({
        totalInventory: totalQty,
        importsToday: todayImports,
        exportsToday: todayExports,
        pendingChecks: pendingCheck,
        lowStockCount: lowStock.length
      });

      // 2. Xử lý dữ liệu biểu đồ Bar (7 ngày qua)
      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().split('T')[0];
        return {
          day: d.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit' }),
          nhap: imports.filter(p => p.NgayNhap?.startsWith(dateStr)).length,
          xuat: exports.filter(p => p.NgayXuat?.startsWith(dateStr)).length,
        };
      });
      setChartData(last7Days);

      // 3. Xử lý biểu đồ tròn (Theo danh mục)
      const catMap = {};
      products.forEach(p => {
        const catName = p.category || p.TenDanhMuc || "Khác";
        catMap[catName] = (catMap[catName] || 0) + (stockMap[p.id] || 0);
      });
      setPieData(Object.entries(catMap).map(([name, value]) => ({ name, value })).slice(0, 4));

      // 4. Cập nhật các danh sách bảng
      setPendingImports(imports.filter(p => p.TrangThai === "ChoDuyet").slice(0, 5));
      setLowStockList(normalizedLowStock.slice(0, 5));
      setIncidentList(warranties.filter(w => w.TrangThai === "ChoBaoHanh").slice(0, 5));

    } catch (err) {
      console.error("Lỗi Staff Dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  // Hàm đồng bộ thông tin user từ localStorage
  const syncUser = () => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setCurrentUser(normalizeUserSession(JSON.parse(savedUser)));
      } catch (e) {
        console.error("Lỗi sync user tại StaffDashboard:", e);
      }
    }
  };

  useEffect(() => {
    syncUser(); // Chạy ngay khi mount để đảm bảo có dữ liệu sau login
    loadDashboardData();

    // Lắng nghe sự kiện cập nhật profile (dùng cho trường hợp đổi ảnh/tên ở ProfilePage)
    window.addEventListener("user-updated", syncUser);
    return () => window.removeEventListener("user-updated", syncUser);
  }, []);

  const staffMenu = menuByRole[ROLES.staff];

  // Helper để tìm một mục menu dựa trên path hoặc label
  const findMenuItem = (criteria) => {
    return staffMenu.find(item => item.path === criteria || item.label === criteria);
  };

  // 🚀 Hàm xử lý điều hướng thông minh khi nhấn vào thẻ KPI
  const handleKpiClick = (type) => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    switch (type) {
      case "TOTAL_INVENTORY":
        navigate("/inventory");
        break;
      case "IMPORTS_TODAY":
        localStorage.setItem("importDateFilter", todayStr);
        navigate("/imports");
        break;
      case "EXPORTS_TODAY":
        localStorage.setItem("exportDateFilter", todayStr);
        navigate("/exports");
        break;
      case "PENDING_CHECKS":
        localStorage.setItem("importStatusFilter", "ChoDuyet");
        navigate("/imports");
        break;
      case "LOW_STOCK":
        localStorage.setItem("inventoryStatusFilter", "DANGER"); // Lọc cả 'Sắp hết' và 'Hết hàng'
        navigate("/inventory");
        break;
      default:
        break;
    }
  };

  // Danh sách các thao tác nhanh cho nhân viên
  const quickActions = [
    { label: "Tạo phiếu nhập", icon: FileInput, path: "/imports", color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Tạo phiếu xuất", icon: FileOutput, path: "/exports", color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Thêm sản phẩm", icon: Package, path: "/products", color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Báo cáo tồn kho", icon: AlertTriangle, path: "/reports", color: "text-red-600", bg: "bg-red-50" },
  ];

  // Định nghĩa các StatCard dựa trên menu và dữ liệu mock
  const dashboardStatConfigs = [
    {
      type: "TOTAL_INVENTORY",
      title: findMenuItem("/inventory")?.label || "Tổng tồn kho", // Lấy từ menu "Tồn kho"
      value: stats.totalInventory.toLocaleString(),
      note: "Sản phẩm thực tế",
      icon: findMenuItem("/inventory")?.icon || Warehouse,
      color: "blue"
    },
    {
      type: "IMPORTS_TODAY",
      title: findMenuItem("/imports")?.label || "Nhập hôm nay", // Lấy từ menu "Phiếu nhập"
      value: stats.importsToday,
      note: "Phiếu nhập mới",
      icon: findMenuItem("/imports")?.icon || FileInput,
      color: "green"
    },
    {
      type: "EXPORTS_TODAY",
      title: findMenuItem("/exports")?.label || "Xuất hôm nay", // Lấy từ menu "Phiếu xuất"
      value: stats.exportsToday,
      note: "Phiếu xuất mới",
      icon: findMenuItem("/exports")?.icon || FileOutput,
      color: "orange"
    },
    {
      type: "PENDING_CHECKS",
      title: "Phiếu chờ duyệt", 
      value: stats.pendingChecks,
      note: "Xem chi tiết",
      icon: ClipboardCheck,
      color: "purple"
    },
    {
      type: "LOW_STOCK",
      title: "Sản phẩm sắp hết", 
      value: stats.lowStockCount,
      note: "Xem danh sách",
      icon: AlertTriangle,
      color: "cyan"
    },
  ];

const pieColors = ["#2563eb", "#22c55e", "#f59e0b", "#8b5cf6"];

  return (
    <MainLayout role={ROLES.staff}>
      <DashboardGreeting
        role={ROLES.staff}
        userName={currentUser?.TenNhanVien}
        description="Đây là tổng quan hoạt động kho ngày hôm nay"
      />

      {loading && <div className="text-center py-10 text-gray-400 animate-pulse">⏳ Đang tải dữ liệu vận hành...</div>}

      {!loading && (
        <>
      {/* Các StatCard được tạo động từ cấu hình */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {dashboardStatConfigs.map((stat, index) => (
          <div 
            key={index} 
            onClick={() => handleKpiClick(stat.type)}
            className="cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group"
          >
            <StatCard
              title={stat.title}
              value={stat.value}
              note={stat.note}
              icon={stat.icon}
              color={stat.color}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 min-w-0 rounded-2xl bg-white p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-800 text-base">Nhập - Xuất kho</h3>
              <p className="text-xs text-gray-500">Thống kê lưu lượng hàng hóa</p>
            </div>
            <select className="rounded-xl border px-3 py-2 text-sm">
              <option>7 ngày qua</option>
              <option>30 ngày qua</option>
            </select>
          </div>

          <div className="w-full h-72 min-w-0">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="nhap" name="Nhập kho" fill="#2563eb" radius={[8, 8, 0, 0]} />
                <Bar dataKey="xuat" name="Xuất kho" fill="#22c55e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl bg-white p-5 border border-gray-200 shadow-sm">
          <div className="mb-4">
            <h3 className="font-bold text-gray-800 text-base">Tồn kho theo danh mục</h3>
            <p className="text-xs text-gray-500">Phân bổ nhóm sản phẩm</p>
          </div>
          <div className="w-full h-72 min-w-0">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95}>
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ⚡ KHỐI THAO TÁC NHANH - Bổ sung cho giao diện nhân viên */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6">
        <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-2">
          <PlusCircle size={18} className="text-blue-600"/> Thao tác nghiệp vụ nhanh
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => navigate(action.path)}
              className={`flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-gray-200 transition-all ${action.bg} group shadow-xs`}
            >
              <action.icon className={`${action.color} group-hover:scale-110 transition-transform`} size={20} />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-tight">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <section className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-gray-800">Phiếu nhập cần kiểm tra</h3>
              <p className="text-xs text-gray-400">Các phiếu mới cần xác nhận thực tế</p>
            </div>
            <button onClick={() => navigate("/imports")} className="text-sm text-blue-600">Xem tất cả</button>
          </div>

          <DataTable
            columns={[
              { key: "MaPhieu", label: "Mã phiếu" },
              { key: "MaNCC", label: "Mã NCC" },
              { key: "NgayNhap", label: "Ngày tạo", render: (v) => v ? new Date(v).toLocaleDateString("vi-VN") : "—" },
              { key: "TrangThai", label: "Trạng thái", render: (value) => <StatusBadge status={value} /> },
            ]}
            data={pendingImports}
          />
        </section>

        <section className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-gray-800">Sản phẩm sắp hết</h3>
              <p className="text-xs text-gray-400">Cần kế hoạch nhập thêm hàng</p>
            </div>
            <button onClick={() => navigate("/inventory")} className="text-sm text-blue-600">Xem tất cả</button>
          </div>

          <DataTable
            columns={[
              { key: "MaSP", label: "Mã", render: (v) => <span className="font-mono text-xs">#{v}</span> },
              { key: "TenSanPham", label: "Sản phẩm", render: (v) => <span className="font-medium text-gray-700 block max-w-[150px] truncate">{v}</span> },
              { key: "SoLuongTon", label: "Hiện tại", render: (v) => <span className="text-red-600 font-bold">{v}</span> },
              { key: "SoLuongToiThieu", label: "Định mức", render: (v) => <span className="text-gray-400">{v}</span> },
            ]}
            data={lowStockList}
          />
        </section>
      </div>

      {/* <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-gray-800">Báo cáo vấn đề</h3>
              <p className="text-xs text-gray-400">Sự cố hư hỏng hoặc thất thoát</p>
            </div>
            <button onClick={() => navigate("/baohanh")} className="text-sm text-blue-600">Xem tất cả</button>
          </div>

          <DataTable
            columns={[
              { key: "MaBaoHanh", label: "Mã BC" },
              { key: "TenSanPham", label: "Sản phẩm" },
              { key: "LoaiBaoHanh", label: "Loại" },
              { key: "TrangThai", label: "Trạng thái", render: (value) => <StatusBadge status={value} /> },
            ]}
            data={incidentList}
          />
        </section>
      </div> */}
      </>
      )}
    </MainLayout>
  );
}
