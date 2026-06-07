import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Package, FileInput, FileOutput, AlertTriangle, Users, ClipboardCheck, ArrowRight, ShieldCheck, History, Warehouse, TrendingUp } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import DashboardGreeting from "../components/DashboardGreeting";
import StatCard from "../components/StatCard";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { ROLES } from "../services/auth";
import { getProducts } from "../services/productService";
import { getTonKhoItems } from "../services/tonKhoService";

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalValue: 0,
    totalQuantity: 0,
    skuCount: 0,
    importsToday: 0,
    exportsToday: 0,
    alerts: 0
  });

  // Dữ liệu gốc tải về từ API (Giữ nguyên không thay đổi trực tiếp)
  const [originImports, setOriginImports] = useState([]);
  const [originLowStock, setOriginLowStock] = useState([]);
  const [originProducts, setOriginProducts] = useState([]);
  const [originExports, setOriginExports] = useState([]);
  const [warrantyList, setWarrantyList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔍 STATE LỌC KHÓA (ACTIVE FILTER): Xác định thẻ KPI nào đang được chọn nhấn
  // Giá trị nhận vào: "ALL_QUANTITY" | "IMPORTS_TODAY" | "EXPORTS_TODAY" | "DANGER" | "" (Mặc định không lọc)
  const [activeKpiFilter, setActiveKpiFilter] = useState("");

  const getToken = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
  const headers = { Authorization: `Bearer ${getToken()}` };

  const formatCurrency = (amount, shorthand = false) => {
    if (!amount) return "0 đ";
    if (shorthand) {
      if (amount >= 1000000000) {
        return (amount / 1000000000).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " tỷ (VND)";
      }
      if (amount >= 1000000) {
        return (amount / 1000000).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " triệu (VND)";
      }
    }
    return new Intl.NumberFormat("vi-VN").format(amount) + " đ";
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [products, tonKhoItems, importsRes, exportsRes, staffRes, baohanhRes] = await Promise.all([
        getProducts(), 
        getTonKhoItems(), 
        axios.get("http://localhost:3000/phieunhap/danhsach", { headers }),
        axios.get("http://localhost:3000/phieuxuat/danhsach", { headers }),
        axios.get("http://localhost:3000/nhanvien/danhsach", { headers }),
        axios.get("http://localhost:3000/baohanh/danhsach", { headers })
      ]);

      const allProducts = products || [];
      const allInventory = tonKhoItems || [];
      const allImports = importsRes.data.data || [];
      const allExports = exportsRes.data.data || [];
      const allStaff = staffRes.data.data || [];
      const allBaoHanh = baohanhRes.data.data || [];

      // 📊 1. Tính toán số liệu KPIs
      const todayStr = new Date().toISOString().split('T')[0];
      
      const totalQty = allInventory.reduce((sum, item) => {
        const raw = item?.data ?? item?.item ?? item ?? {};
        return sum + (Number(raw.SoLuongTon || raw.soLuongTon || 0));
      }, 0);

      const stockMap = allInventory.reduce((acc, item) => {
        const raw = item?.data ?? item?.item ?? item ?? {};
        const pid = raw.MaSanPham || raw.maSanPham;
        acc[pid] = (acc[pid] || 0) + Number(raw.SoLuongTon || raw.soLuongTon || 0);
        return acc;
      }, {});

      // Đồng bộ chuẩn cấu trúc dữ liệu với API sản phẩm sắp hết hàng
      const lowStock = allProducts.filter(p => {
        const currentQty = stockMap[p.id] || 0;
        return currentQty <= (Number(p.minQuantity) || 0);
      }).map(p => ({
        ...p,
        MaSP: p.code || p.MaSP || p.id,
        TenSanPham: p.name || p.TenSanPham,
        SoLuongTon: stockMap[p.id] || 0,
        SoLuongToiThieu: p.minQuantity || p.SoLuongToiThieu || 0
      }));

      // 🌟 Map toàn bộ danh sách sản phẩm kèm tồn kho (không lọc)
      const productsWithStock = allProducts.map(p => ({
        ...p,
        MaSP: p.code || p.MaSP || p.id,
        TenSanPham: p.name || p.TenSanPham,
        SoLuongTon: stockMap[p.id] || 0,
        SoLuongToiThieu: p.minQuantity || p.SoLuongToiThieu || 0
      }));

      const todayImports = allImports.filter(p => p.NgayNhap?.startsWith(todayStr)).length;
      const todayExports = allExports.filter(p => p.NgayXuat?.startsWith(todayStr)).length;
      const totalVal = allImports.filter(p => p.TrangThai === "DaDuyet").reduce((sum, p) => sum + (p.TongTien || 0), 0);

      setStats({
        totalValue: totalVal,
        totalQuantity: totalQty,
        skuCount: allProducts.length,
        importsToday: todayImports,
        exportsToday: todayExports,
        alerts: lowStock.length
      });

      // Lưu trữ mảng gốc đầy đủ
      setOriginImports(allImports);
      setOriginLowStock(lowStock);
      setOriginProducts(productsWithStock);
      setOriginExports(allExports);
      setStaffList(allStaff.slice(0, 5));
      setWarrantyList(allBaoHanh.slice(0, 5));

    } catch (error) {
      console.error("Lỗi khi tải dữ liệu Manager Dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // 📋 ĐỊNH NGHĨA CÁC BỘ CỘT CHO TỪNG LOẠI DỮ LIỆU
  const productColumns = [
    { key: "MaSP", label: "Mã", render: (v) => <span className="font-mono text-xs">#{v}</span> },
    { key: "TenSanPham", label: "Sản phẩm", render: (v) => <span className="font-medium text-gray-700 block max-w-[200px] truncate">{v}</span> },
    { key: "SoLuongTon", label: "Tồn kho", render: (v) => <span className="text-gray-600 font-bold">{v}</span> },
    { key: "SoLuongToiThieu", label: "An toàn", render: (v) => <span className="text-gray-400">{v}</span> },
  ];

  const importColumns = [
    { key: "MaPhieu", label: "Mã phiếu", render: (v) => <span className="font-mono font-bold text-gray-900 text-xs">{v}</span> },
    { key: "MaNCC", label: "Nhà cung cấp", render: (v, row) => <span className="text-xs">{row.TenNCC || `Mã NCC: #${v}`}</span> },
    { key: "NgayNhap", label: "Ngày nhập", render: (v) => <span className="text-xs">{v ? new Date(v).toLocaleString("vi-VN") : "—"}</span> },
    { key: "TongTien", label: "Giá trị", render: (v) => <span className="font-bold text-emerald-600">{formatCurrency(v)}</span> },
    { key: "TrangThai", label: "Trạng thái", render: (v) => <StatusBadge status={v} /> },
  ];

  const exportColumns = [
    { key: "MaPhieu", label: "Mã phiếu", render: (v) => <span className="font-mono font-bold text-gray-900 text-xs">{v}</span> },
    { key: "TenKH", label: "Khách hàng", render: (v, row) => <span className="text-xs truncate block max-w-[120px]">{v || `KH #${row.MaKH}`}</span> },
    { key: "NgayXuat", label: "Ngày xuất", render: (v) => <span className="text-xs">{v ? new Date(v).toLocaleString("vi-VN") : "—"}</span> },
    { key: "TongTien", label: "Giá trị", render: (v) => <span className="font-bold text-gray-700">{formatCurrency(v)}</span> },
  ];

  // ⚙️ LOGIC LẤY CẤU HÌNH BẢNG HIỂN THỊ DỰA TRÊN KPI ĐANG CHỌN
  const getActiveTableConfig = () => {
    const todayStr = new Date().toISOString().split('T')[0];

    switch (activeKpiFilter) {
      case "VALUE":
        return {
          title: "Phiếu nhập đã hoàn tất",
          icon: <TrendingUp size={22} className="text-blue-500"/>,
          columns: importColumns,
          data: originImports.filter(p => p.TrangThai === "DaDuyet"),
          path: "/imports"
        };
      case "IMPORTS_TODAY":
        const todayIm = originImports.filter(p => p.NgayNhap?.startsWith(todayStr));
        return {
          title: `Phiếu nhập hôm nay (${todayIm.length})`,
          icon: <FileInput size={22} className="text-cyan-500"/>,
          columns: importColumns,
          data: todayIm,
          path: "/imports"
        };
      case "EXPORTS_TODAY":
        const todayEx = originExports.filter(p => p.NgayXuat?.startsWith(todayStr));
        return {
          title: `Phiếu xuất hôm nay (${todayEx.length})`,
          icon: <FileOutput size={22} className="text-orange-500"/>,
          columns: exportColumns,
          data: todayEx,
          path: "/exports"
        };
      case "DANGER":
        return {
          title: `Sản phẩm nguy cơ cạn kho (${originLowStock.length})`,
          icon: <AlertTriangle size={22} className="text-red-500"/>,
          columns: productColumns,
          data: originLowStock,
          path: "/inventory"
        };
      case "ALL_QUANTITY":
        return {
          title: `Toàn bộ danh mục hàng hóa (${originProducts.length})`,
          icon: <Package size={22} className="text-green-500"/>,
          columns: productColumns,
          data: originProducts,
          path: "/products"
        };
      default:
        return {
          title: "Mặt hàng sản phẩm nổi bật",
          icon: <Package size={22} className="text-green-500"/>,
          columns: productColumns,
          data: originProducts.slice(0, 5),
          path: "/products"
        };
    }
  };

  const activeTable = getActiveTableConfig();
  const viewLowStock = originLowStock.slice(0, 5);
  const viewExports = originExports.filter(p => p.NgayXuat?.startsWith(new Date().toISOString().split('T')[0])).slice(0, 5);

  // Hàm toggle bộ lọc thông minh (Nếu click lại thẻ đang chọn sẽ reset bộ lọc về mặc định)
  const handleKpiClick = (filterName) => {
    setActiveKpiFilter(prev => prev === filterName ? "" : filterName);
  };

  const quickActions = [
    { label: "Phê duyệt phiếu", icon: ShieldCheck, path: "/approvals", color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Tạo phiếu nhập", icon: FileInput, path: "/imports", color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Tạo phiếu xuất", icon: FileOutput, path: "/exports", color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Báo cáo tồn kho", icon: TrendingUp, path: "/reports", color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Xử lý bảo hành", icon: History, path: "/baohanh", color: "text-red-600", bg: "bg-red-50" },
    { label: "Cấu hình kho", icon: Warehouse, path: "/kho", color: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  return (
    <MainLayout role={ROLES.manager}>
      <div className="flex justify-between items-center mb-2">
        <DashboardGreeting
          role={ROLES.manager}
          description="Chúc bạn 1 ngày làm việc vui vẻ! Dưới đây là tổng quan về hoạt động kho hàng của bạn."
        />
        {activeKpiFilter && (
          <button 
            onClick={() => setActiveKpiFilter("")}
            className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-xl font-bold hover:bg-gray-200 transition-all shadow-sm"
          >
            ✕ Hủy bộ lọc nhanh KPI
          </button>
        )}
      </div>

      {/* 🚀 KHỐI KPI CHÍNH - ĐÃ SỬA ĐỂ LỌC NHANH HOẶC DOUBLE CLICK ĐỂ CHUYỂN TRANG */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8"> 
        <div 
          onClick={() => handleKpiClick("VALUE")} 
          title={`Tổng giá trị: ${formatCurrency(stats.totalValue)}`}
          className={`cursor-pointer transition-all rounded-3xl ${activeKpiFilter === 'VALUE' ? 'ring-2 ring-blue-500 bg-blue-50/20 scale-[1.02] shadow-md' : 'hover:scale-[1.01]'}`}
        >
          <StatCard 
            title="Giá trị nhập kho" 
            value={formatCurrency(stats.totalValue, true)} 
            note="Hàng đã nhập " 
            icon={TrendingUp} 
            color="blue" 
          />
        </div>

        <div onClick={() => handleKpiClick("ALL_QUANTITY")} className={`cursor-pointer transition-all rounded-3xl ${activeKpiFilter === 'ALL_QUANTITY' ? 'ring-2 ring-green-500 bg-green-50/20 scale-[1.02] shadow-md' : 'hover:scale-[1.01]'}`}>
          <StatCard 
            title="Tổng sản lượng" 
            value={stats.skuCount.toLocaleString()} 
            note={`${stats.skuCount} mặt hàng `} 
            icon={Package} 
            color="green" 
          />
        </div>

        <div onClick={() => handleKpiClick("IMPORTS_TODAY")} className={`cursor-pointer transition-all rounded-3xl ${activeKpiFilter === 'IMPORTS_TODAY' ? 'ring-2 ring-cyan-500 bg-cyan-50/20 scale-[1.02] shadow-md' : 'hover:scale-[1.01]'}`}>
          <StatCard 
            title="Nhập hôm nay" 
            value={stats.importsToday} 
            note="Phiếu trong ngày " 
            icon={FileInput} 
            color="cyan" 
          />
        </div>

        <div onClick={() => handleKpiClick("EXPORTS_TODAY")} className={`cursor-pointer transition-all rounded-3xl ${activeKpiFilter === 'EXPORTS_TODAY' ? 'ring-2 ring-orange-500 bg-orange-50/20 scale-[1.02] shadow-md' : 'hover:scale-[1.01]'}`}>
          <StatCard 
            title="Xuất hôm nay" 
            value={stats.exportsToday} 
            note="Phiếu trong ngày " 
            icon={FileOutput} 
            color="orange" 
          />
        </div>

        <div onClick={() => handleKpiClick("DANGER")} className={`cursor-pointer transition-all rounded-3xl ${activeKpiFilter === 'DANGER' ? 'ring-2 ring-red-600 bg-red-50/20 scale-[1.02] shadow-md' : 'hover:scale-[1.01]'}`}>
          <StatCard 
            title="Nguy cơ" 
            value={stats.alerts} 
            note="Hàng sắp hết/hết " 
            icon={AlertTriangle} 
            color="red" 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* 📋 KHỐI DỮ LIỆU CHÍNH (Sản phẩm hoặc Phiếu nhập) */}
        <section className={`lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm transition-all ${activeKpiFilter ? 'border-blue-400 ring-4 ring-blue-500/5 shadow-md' : ''}`}>
          <div className="flex items-center justify-between mb-5">
                      <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        {activeTable.icon}
                        {activeTable.title}
                      </h3>
                      <button 
                        onClick={() => navigate(activeTable.path)} 
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Đi tới trang quản lý <ArrowRight size={14}/>
                      </button>
          </div>
          
          <DataTable columns={activeTable.columns} data={activeTable.data} />
          
          {activeTable.data.length === 0 && (
            <p className="text-xs text-gray-400 italic text-center p-4">Hiện tại không có dữ liệu để hiển thị.</p>
          )}
        </section>

        {/* ⚡ THAO TÁC NHANH */}
        <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 text-lg mb-5">Truy cập nhanh</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => navigate(action.path)}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border border-transparent hover:border-gray-200 transition-all ${action.bg} group`}
              >
                <action.icon className={`${action.color} mb-2 group-hover:scale-110 transition-transform`} size={24} />
                <span className="text-[11px] font-bold text-gray-700 text-center uppercase tracking-tight">{action.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ⚠️ CẢNH BÁO TỒN KHO */}
        <section className={`bg-white p-6 rounded-3xl border border-gray-100 shadow-sm transition-all ${activeKpiFilter === 'DANGER' ? 'border-red-400 ring-4 ring-red-500/5 shadow-md scale-[1.01]' : ''}`}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <AlertTriangle size={22} className="text-amber-500"/> 
              Sản phẩm dưới định mức
            </h3>
            <button onClick={() => navigate("/inventory")} className="text-xs font-bold text-amber-600 hover:underline">Kiểm kho chi tiết</button>
          </div>
          <DataTable
            columns={[
              { key: "MaSP", label: "Mã", render: (v) => <span className="font-mono text-xs">#{v}</span> },
              { key: "TenSanPham", label: "Sản phẩm", render: (v) => <span className="font-medium text-gray-700 block max-w-[150px] truncate">{v}</span> },
              { key: "SoLuongTon", label: "Hiện tại", render: (v) => <span className="text-red-600 font-bold">{v}</span> },
              { key: "SoLuongToiThieu", label: "An toàn", render: (v) => <span className="text-gray-400">{v}</span> },
            ]}
            data={viewLowStock}
          />
          {viewLowStock.length === 0 && <p className="text-xs text-gray-400 italic text-center p-4">Kho hàng an toàn, không có sản phẩm báo động.</p>}
        </section>

        {/* 🚛 GIAO DỊCH GẦN ĐÂY */}
        <section className={`bg-white p-6 rounded-3xl border border-gray-100 shadow-sm transition-all ${activeKpiFilter === 'EXPORTS_TODAY' ? 'border-orange-400 ring-4 ring-orange-500/5 shadow-md scale-[1.01]' : ''}`}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-800 text-lg">
              Xuất kho gần đây
            </h3>
            <button onClick={() => navigate("/exports")} className="text-xs font-bold text-gray-400 hover:text-gray-600">Lịch sử</button>
          </div>
          <DataTable
            columns={[
              { key: "MaPhieu", label: "Mã phiếu", render: (v) => <span className="font-mono text-xs">{v}</span> },
              { key: "TenKH", label: "Khách hàng", render: (v, row) => <span className="text-xs truncate block max-w-[120px]">{v || `KH #${row.MaKH}`}</span> },
              { key: "TongTien", label: "Giá trị", render: (v) => <span className="font-bold text-gray-700">{formatCurrency(v)}</span> },
            ]}
            data={viewExports}
          />
          {viewExports.length === 0 && <p className="text-xs text-gray-400 italic text-center p-4">Không có dữ liệu phiếu xuất phù hợp.</p>}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* 🛠️ BẢO HÀNH & NHÂN SỰ */}
        <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 text-lg mb-5">Tiếp nhận bảo hành</h3>
          <DataTable
            columns={[
              { key: "TenSanPham", label: "Sản phẩm", render: (v) => <span className="text-xs font-medium truncate block max-w-[150px]">{v}</span> },
              { key: "LoaiBaoHanh", label: "Loại" },
              { key: "TrangThai", label: "Trạng thái", render: (v) => <StatusBadge status={v} /> },
            ]}
            data={warrantyList}
          />
        </section>

        <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 text-lg mb-5">Đội ngũ vận hành</h3>
          <DataTable
            columns={[
              { key: "TenNhanVien", label: "Nhân viên", render: (v) => <span className="font-medium">{v}</span> },
              { key: "TrangThai", label: "Kết nối", render: (v) => v ? <span className="flex items-center gap-1.5 text-green-600 text-xs font-bold"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Đang hoạt động</span> : <span className="text-gray-300 text-xs italic">Ngoại tuyến</span> },
            ]}
            data={staffList}
          />
        </section>
      </div>
    </MainLayout>
  );
}