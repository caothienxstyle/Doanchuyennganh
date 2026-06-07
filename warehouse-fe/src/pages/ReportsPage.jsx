import { useEffect, useState, useMemo } from "react";
import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { getProducts } from "../services/productService";
import axios from "axios";
import { getTonKhoItems } from "../services/tonKhoService";
import { Search, Package, BarChart3, AlertTriangle, ShieldAlert } from "lucide-react";

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Các biến lưu số liệu thống kê tổng hợp (KPIs)
  const [stats, setStats] = useState({
    totalProducts: 0,       // Tổng số mặt hàng
    totalStockQuantity: 0,  // Tổng số lượng hàng trong kho
    lowStockCount: 0,       // Số mặt hàng sắp hết
    outOfStockCount: 0,     // Số mặt hàng đã hết nhẵn
  });

  // Danh sách chi tiết phục vụ bảng báo cáo nguy cơ
  const [alertProductsList, setAlertProductsList] = useState([]);
  // Danh sách sản phẩm đã tổng hợp tồn kho (dùng cho chế độ xem tổng hợp)
  const [aggregatedProductsList, setAggregatedProductsList] = useState([]);
  // Danh sách thống kê theo vị trí (dành cho Card 2)
  const [locationReportList, setLocationReportList] = useState([]);
  const [viTriList, setViTriList] = useState([]); // Danh sách vị trí kho để tra cứu

  // 🔢 Trạng thái Phân trang & Tìm kiếm (Đồng bộ với ApprovePage)
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // State lọc theo trạng thái từ thẻ KPI
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState("1");
  const [displayMode, setDisplayMode] = useState("aggregated"); // "aggregated", "detailed", "location"

  const getToken = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";

  // Hàm tính toán trạng thái tương tự bên trang Tồn kho của bạn
  function getInventoryStatus(quantity, minQuantity) {
    if (minQuantity === undefined || minQuantity === null || minQuantity === "" || minQuantity === "—") {
      return "Ổn định";
    }
    const q = Number(quantity) || 0;
    const m = Number(minQuantity);
    if (q === 0) return "Hết hàng";
    return q <= m ? "Sắp hết" : "Ổn định";
  }

  async function loadReportData() {
    try {
      setLoading(true);
      const [productsResult, tonKhoResult, viTriResult] = await Promise.allSettled([
        getProducts(), getTonKhoItems(), axios.get("http://localhost:3000/vitrikho/danhsach", { headers: { Authorization: `Bearer ${getToken()}` } })
      ]);

      if (productsResult.status !== "fulfilled") {
        throw productsResult.reason;
      }

      // 🌟 FIX: Đảm bảo trích xuất đúng mảng dữ liệu từ các kết quả API
      const products = productsResult.status === "fulfilled" ? (productsResult.value.data || productsResult.value || []) : [];
      const tonKhoItems = tonKhoResult.status === "fulfilled" ? (tonKhoResult.value.data || tonKhoResult.value || []) : [];
      const rawViTriList = viTriResult.status === "fulfilled" ? (viTriResult.value.data?.data || viTriResult.value.data || []) : [];
      
      setViTriList(rawViTriList); // Lưu danh sách vị trí vào state

      const viTriMap = new Map();
      if (Array.isArray(rawViTriList)) {
        rawViTriList.forEach(vt => { if (vt.MaViTriCode) viTriMap.set(vt.MaViTriCode, vt); });
      }


      // 1. Tạo Map để map nhanh thông tin sản phẩm
      const productMap = new Map();
      products.forEach((p) => {
        const idKey = String(p.id || p.MaSanPham);
        const codeKey = String(p.code || p.MaSP);
        if (idKey && idKey !== "undefined") productMap.set(idKey, p);
        if (codeKey && codeKey !== "undefined") productMap.set(codeKey, p);
      });

      // 2. Chuẩn hóa dữ liệu tồn kho: Xử lý 1 lần duy nhất để tránh sai lệch số liệu do không đồng nhất key
      const normalizedInventory = tonKhoItems.map(item => {
        const d = item?.data ?? item?.item ?? item?.record ?? item ?? {};
        const n = d?.tonKho ?? d?.tonkho ?? d?.inventory ?? d?.detail ?? {};
        
        // Sử dụng Nullish Coalescing (??) để ưu tiên đúng các thuộc tính số lượng (bao gồm cả số 0)
        const qty = Number(d.SoLuongTon ?? d.soLuongTon ?? n.SoLuongTon ?? n.soLuongTon ?? d.quantity ?? n.quantity ?? 0);
        const pid = String(d.MaSanPham || d.maSanPham || n.MaSanPham || n.maSanPham || d.id || n.id || "");
        const pCode = String(d.MaSP || d.maSP || n.MaSP || n.maSP || d.code || n.code || "");
        const vtCode = String(d.MaViTriCode ?? d.maViTriCode ?? n.MaViTriCode ?? n.maViTriCode ?? "").trim();
        
        return { qty: isNaN(qty) ? 0 : qty, pid, pCode, vtCode, rawKho: d.MaKho || n.MaKho || 1 };
      });

      // 3. Xử lý gom nhóm dữ liệu (Aggregations)
      let totalPhysicalStock = 0;
      const stockSummary = new Map();
      const locationAggregationMap = new Map();
      const khoNameMap = new Map();

      // Tạo map Tên Kho từ danh sách vị trí để hiển thị chuẩn xác
      rawViTriList.forEach(v => {
        if (v.MaKho) khoNameMap.set(String(v.MaKho), v.TenKho || `Kho #${v.MaKho}`);
      });

      normalizedInventory.forEach(item => {
        totalPhysicalStock += item.qty; // 📈 Cộng dồn trực tiếp từ cột SoLuongTon của bảng TonKho để khớp 100% DB
        // Gom nhóm theo Sản phẩm
        if (item.pid) {
          stockSummary.set(item.pid, (stockSummary.get(item.pid) || 0) + item.qty);
        }

        // Gom nhóm theo VỊ TRÍ KHO (Dành cho yêu cầu của bạn ở Card 2)
        const locKey = `${item.rawKho}-${item.vtCode}`;
        if (!locationAggregationMap.has(locKey)) {
          locationAggregationMap.set(locKey, { 
            maKho: item.rawKho, 
            vtCode: item.vtCode, 
            totalQty: 0, 
            pids: new Set() 
          });
        }
        const locData = locationAggregationMap.get(locKey);
        locData.totalQty += item.qty;
        if (item.pid) locData.pids.add(item.pid);
      });

      // 4. Tạo danh sách tồn kho chi tiết: Chỉ lấy các bản ghi thuộc về sản phẩm hợp lệ trong danh mục
      const validProductIds = new Set(products.map(p => String(p.id || p.MaSanPham)));
      
      const detailedInventoryRows = normalizedInventory
        .filter(item => validProductIds.has(item.pid)) // 🛡️ Loại bỏ dữ liệu "ma" không thuộc sản phẩm nào
        .map((item, index) => {
          const product = productMap.get(item.pid) || productMap.get(item.pCode);
          const viTriInfo = viTriMap.get(item.vtCode);
          
          const locationStr = viTriInfo?.TenViTriHienThi ||
            [viTriInfo?.KhuVuc, viTriInfo?.DayKe, viTriInfo?.Tang, viTriInfo?.OKe].filter(Boolean).join(" / ") ||
            `Mã vị trí: ${item.vtCode || "—"}`;

          return {
            id: `${item.pid}-${item.rawKho}-${index}`,
            code: product?.code ?? product?.MaSP ?? item.pCode ?? "—",
            name: product?.name ?? product?.TenSanPham ?? "Chưa cập nhật",
            quantity: item.qty,
            minQuantity: product?.minQuantity ?? product?.SoLuongToiThieu ?? "—",
            location: locationStr,
            status: getInventoryStatus(item.qty, product?.minQuantity || product?.SoLuongToiThieu),
          };
        });
      
      // 5. Đảm bảo danh mục sản phẩm duy nhất để tránh đếm trùng KPI
      const uniqueProducts = Array.from(new Map(products.map(p => [String(p.id || p.MaSanPham), p])).values());

      // Chuyển đổi dữ liệu gom nhóm vị trí thành danh sách hiển thị
      const locationRows = Array.from(locationAggregationMap.values()).map(loc => {
        const vtInfo = viTriMap.get(loc.vtCode);
        return {
          id: `loc-${loc.maKho}-${loc.vtCode}`,
          tenKho: khoNameMap.get(String(loc.maKho)) || `Kho #${loc.maKho}`,
          location: vtInfo?.TenViTriHienThi || [vtInfo?.KhuVuc, vtInfo?.DayKe, vtInfo?.Tang, vtInfo?.OKe].filter(Boolean).join(" / ") || loc.vtCode || "—",
          quantity: loc.totalQty,
          productCount: loc.pids.size,
          code: loc.vtCode,
          name: khoNameMap.get(String(loc.maKho)) || ""
        };
      });

      let lowStock = 0;
      let outOfStock = 0;
      const allReportRows = uniqueProducts.map((p) => {
        const pIdStr = String(p.id || p.MaSanPham);
        const totalQty = stockSummary.get(pIdStr) || 0;

        const minQty = p.minQuantity || p.SoLuongToiThieu;
        const status = getInventoryStatus(totalQty, minQty);

        if (status === "Hết hàng") outOfStock++;
        if (status === "Sắp hết") lowStock++;

        return {
          code: p.code || p.MaSP || "—",
          name: p.name || p.TenSanPham || "Chưa cập nhật",
          quantity: totalQty,
          minQuantity: minQty ?? "—",
          location: stockSummary.has(pIdStr) ? "Đã phân bổ kho" : "Chưa có vị trí",
          status: status
        };
      });

      // 6. Cập nhật State KPIs: Đảm bảo khớp 100% với dữ liệu aggregated và detailed đã lọc
      setStats({
        totalProducts: uniqueProducts.length,
        totalStockQuantity: totalPhysicalStock, // 🌟 HIỂN THỊ CON SỐ TỔNG TỪ DATABASE
        lowStockCount: lowStock,
        outOfStockCount: outOfStock,
      });

      setAlertProductsList(detailedInventoryRows); // Nguồn dữ liệu chi tiết
      setAggregatedProductsList(allReportRows); // Nguồn dữ liệu tổng hợp
      setLocationReportList(locationRows); // Nguồn dữ liệu thống kê theo kho/vị trí

      setError("");
    } catch (err) {
      setError(err?.message || "Không thể tải dữ liệu báo cáo vận hành kho.");
    } finally {
      setLoading(false);
    }

  }

  useEffect(() => {
    loadReportData();
  }, []);

  // 🔍 LOGIC LỌC DỮ LIỆU THÔNG MINH
  const filteredAlertList = useMemo(() => {
    let listToFilter = aggregatedProductsList;
    if (displayMode === "detailed") listToFilter = alertProductsList;
    if (displayMode === "location") listToFilter = locationReportList;

    return listToFilter.filter((item) => {
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch = !search || (
        String(item.code || "").toLowerCase().includes(search) ||
        String(item.name || "").toLowerCase().includes(search) ||
        String(item.location || "").toLowerCase().includes(search) ||
        String(item.tenKho || "").toLowerCase().includes(search)
      );

      const matchesStatus = displayMode === "location" ? true : (!statusFilter || item.status === statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [alertProductsList, aggregatedProductsList, locationReportList, searchTerm, statusFilter, displayMode]);

  // 🔢 TÍNH TOÁN PHÂN TRANG
  const totalItems = filteredAlertList.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedList = useMemo(() => {
    return filteredAlertList.slice(indexOfFirstItem, indexOfLastItem);
  }, [filteredAlertList, indexOfFirstItem, indexOfLastItem]);

  // Tự động reset trang khi tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, statusFilter]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handlePageInputBlurOrEnter = (e) => {
    if (e.key && e.key !== "Enter") return;
    let targetPage = parseInt(pageInput, 10);
    if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
    if (targetPage > totalPages) targetPage = totalPages;
    setCurrentPage(targetPage);
    setPageInput(String(targetPage));
  };

  // Định nghĩa cột cho chế độ xem tổng hợp
  const aggregatedColumns = [
    { key: "code", label: "Mã SP" },
    { key: "name", label: "Tên sản phẩm" },
    {
      key: "quantity",
      label: "Tổng tồn",
      render: (val, row) => (
        <span className={`font-bold ${row.status === "Hết hàng" ? "text-red-600" : "text-amber-600"}`}>
          {val}
        </span>
      )
    },
    { key: "minQuantity", label: "Định mức tối thiểu" },
    {
      key: "location",
      label: "Phân bổ kho",
      render: (val) => <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 text-xs">{val}</span>
    },
    {
      key: "status",
      label: "Mức độ cảnh báo",
      render: (value) => {
        if (value === "Hết hàng") return (<span className="rounded-full px-2.5 py-1 text-xs font-bold bg-red-50 text-red-600 border border-red-100">🚨 Hết hàng</span>);
        if (value === "Sắp hết") return (<span className="rounded-full px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">⚠️ Sắp hết</span>);
        return (<StatusBadge status={value} />);
      }
    },
  ];

  // Định nghĩa cột cho chế độ xem chi tiết theo vị trí
  const detailedColumns = [
    { key: "code", label: "Mã SP" },
    { key: "name", label: "Tên sản phẩm" },
    {
      key: "quantity",
      label: "Số lượng tồn",
      render: (val, row) => (
        <span className={`font-bold ${row.status === "Hết hàng" ? "text-red-600" : "text-amber-600"}`}>
          {val}
        </span>
      )
    },
    { key: "minQuantity", label: "Định mức tối thiểu" },
    {
      key: "location",
      label: "Vị trí cụ thể",
      render: (val) => <span className="font-mono bg-blue-50 px-1.5 py-0.5 rounded text-blue-600 text-xs">{val}</span>
    },
    {
      key: "status",
      label: "Mức độ cảnh báo",
      render: (value) => {
        if (value === "Hết hàng") return (<span className="rounded-full px-2.5 py-1 text-xs font-bold bg-red-50 text-red-600 border border-red-100">🚨 Hết hàng</span>);
        if (value === "Sắp hết") return (<span className="rounded-full px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">⚠️ Sắp hết</span>);
        return (<StatusBadge status={value} />);
      }
    },
  ];

  // Định nghĩa cột cho chế độ xem THỐNG KÊ THEO VỊ TRÍ KHO
  const locationColumns = [
    { key: "tenKho", label: "Cơ sở Kho" },
    { 
      key: "location", 
      label: "Vị trí kệ cụ thể",
      render: (val) => <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">{val}</span>
    },
    { 
      key: "quantity", 
      label: "Tổng lượng tồn",
      render: (val) => <span className="font-bold text-emerald-600 text-base">{val.toLocaleString("vi-VN")}</span>
    },
    { 
      key: "productCount", 
      label: "Đang chứa",
      render: (val) => <span className="font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full">{val} mặt hàng</span>
    },
  ];


  return (
    <MainLayout>
      {/* TIÊU ĐỀ TRANG BÁO CÁO */}
      <div className="mb-6">
        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Chức năng theo quyền</span>
        <h2 className="text-2xl font-bold text-gray-800 mt-0.5">Báo cáo tồn kho</h2>
        <p className="text-sm text-gray-500">Xem báo cáo tồn kho, giao dịch và các chỉ số vận hành chi tiết.</p>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 p-4 rounded-lg mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">Đang tổng hợp số liệu báo cáo...</p>
      ) : (
        <div className="space-y-6">
          
          {/* 📊 KHU VỰC THẺ SỐ LIỆU TỔNG QUAN (CARDS KPI) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* THẺ 1: TỔNG SỐ MẶT HÀNG (Lọc tổng hợp) */}
            <div
              onClick={() => { setStatusFilter(""); setDisplayMode("aggregated"); }}
              className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-5 rounded-xl border flex items-center justify-between shadow-sm ${statusFilter === "" && displayMode === "aggregated" ? "border-blue-500 ring-2 ring-blue-500/10 shadow-md" : "border-gray-100 hover:border-blue-200"}`}
            >
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase">Tổng số mặt hàng</p>
                <h3 className="text-2xl font-bold text-gray-800 mt-1">{stats.totalProducts}</h3>
              </div>
              <div className={`p-3 rounded-xl transition-colors ${statusFilter === "" && displayMode === "aggregated" ? "bg-blue-600 text-white shadow-sm" : "bg-blue-50 text-blue-600"}`}>
                <Package size={24} />
              </div>
            </div>

            {/* THẺ 2: TỔNG SỐ LƯỢNG TỒN KHO */}
            <div
              onClick={() => { setStatusFilter(""); setDisplayMode("location"); }}
              className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-5 rounded-xl border flex items-center justify-between shadow-sm ${displayMode === "location" ? "border-emerald-500 ring-2 ring-emerald-500/10 shadow-md" : "border-gray-100 hover:border-emerald-200"}`}
            >
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase">Tổng sản lượng tồn</p>
                <h3 className="text-2xl font-bold text-gray-800 mt-1">{stats.totalStockQuantity}</h3>
              </div>
              <div className={`p-3 rounded-xl transition-colors ${displayMode === "location" ? "bg-emerald-600 text-white shadow-sm" : "bg-emerald-50 text-emerald-600"}`}>
                <BarChart3 size={24} />
              </div>
            </div>

            {/* THẺ 3: SẢN PHẨM SẮP HẾT HÀNG */}
            <div 
              onClick={() => { setStatusFilter("Sắp hết"); setDisplayMode("aggregated"); }}
              className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-5 rounded-xl border flex items-center justify-between shadow-sm ${statusFilter === "Sắp hết" && displayMode === "aggregated" ? "border-amber-500 ring-2 ring-amber-500/10 shadow-md" : "border-gray-100 hover:border-amber-200"}`}
            >
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase">Cần nhập thêm (Sắp hết)</p>
                <h3 className="text-2xl font-bold text-amber-600 mt-1">{stats.lowStockCount}</h3>
              </div>
              <div className={`p-3 rounded-xl transition-colors ${statusFilter === "Sắp hết" && displayMode === "aggregated" ? "bg-amber-600 text-white shadow-sm" : "bg-amber-50 text-amber-600"}`}>
                <AlertTriangle size={24} />
              </div>
            </div>

            {/* THẺ 4: SẢN PHẨM ĐÃ HẾT HÀNG */}
            <div 
              onClick={() => { setStatusFilter("Hết hàng"); setDisplayMode("aggregated"); }}
              className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-5 rounded-xl border flex items-center justify-between shadow-sm ${statusFilter === "Hết hàng" && displayMode === "aggregated" ? "border-red-500 ring-2 ring-red-500/10 shadow-md" : "border-gray-100 hover:border-red-200"}`}
            >
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase">Báo động đỏ (Hết hàng)</p>
                <h3 className="text-2xl font-bold text-red-600 mt-1">{stats.outOfStockCount}</h3>
              </div>
              <div className={`p-3 rounded-xl transition-colors ${statusFilter === "Hết hàng" && displayMode === "aggregated" ? "bg-red-600 text-white shadow-sm" : "bg-red-50 text-red-600"}`}>
                <ShieldAlert size={24} />
              </div>
            </div>
          </div>

          {/* 🔍 SEARCH & FILTER BAR (Layout từ ApprovePage) */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3 relative">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tìm kiếm sản phẩm nguy cơ</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                  <input
                    type="text"
                    placeholder="Nhập mã SP, tên sản phẩm hoặc vị trí kho..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Hiển thị</label>
                <select 
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                >
                  <option value={10}>10 dòng / trang</option>
                  <option value={20}>20 dòng / trang</option>
                  <option value={50}>50 dòng / trang</option>
                </select>
              </div>
            </div>
          </div>

          {/* 📋 DANH SÁCH CÁC MẶT HÀNG CẦN CHÚ Ý (NGUY CƠ CAO) */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="font-bold text-gray-800 text-base">{displayMode === "location" ? "Thống kê sản lượng theo từng vị trí kho" : (displayMode === "detailed" ? "Danh sách tồn kho chi tiết theo vị trí" : (statusFilter === "" ? "Danh sách toàn bộ mặt hàng" : `Danh sách mặt hàng: ${statusFilter}`))}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{displayMode === "location" ? "Xem tổng số lượng hàng và số lượng mặt hàng khác nhau đang chứa trong từng ô kệ." : (displayMode === "detailed" ? "Hiển thị số lượng tồn kho của từng sản phẩm tại từng vị trí cụ thể trong kho." : (statusFilter === "" ? "Thống kê tổng quát tình trạng tồn kho của tất cả sản phẩm" : `Danh sách các mặt hàng đang ở trạng thái ${statusFilter}`))}</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full self-start sm:self-auto ${displayMode === "location" ? "bg-emerald-50 text-emerald-700" : (statusFilter === "Hết hàng" ? "bg-red-50 text-red-700" : statusFilter === "Sắp hết" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700")}`}>
                Hiển thị {filteredAlertList.length} kết quả phù hợp
              </span>
            </div>

            {alertProductsList.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                🎉 Tuyệt vời! Hiện tại không có mặt hàng nào bị rơi vào trạng thái cảnh báo hoặc hết hàng.
              </div>
            ) : (
              <DataTable
                columns={displayMode === "location" ? locationColumns : (displayMode === "detailed" ? detailedColumns : aggregatedColumns)}
                data={paginatedList}
              />
            )}
          </div>

          {/* 🔢 PAGINATION NAVIGATION (Layout từ ApprovePage) */}
          {!loading && totalItems > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-500">
              <div>
                Hiển thị từ <span className="font-bold text-gray-800">{indexOfFirstItem + 1}</span> -{" "}
                <span className="font-bold text-gray-800">{Math.min(indexOfLastItem, totalItems)}</span> trên{" "}
                <span className="font-bold text-gray-800">{totalItems}</span> mặt hàng nguy cơ
              </div>

              <div className="flex items-center space-x-2">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all font-medium text-xs">« Đầu</button>
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all font-medium text-xs">‹ Trước</button>
                
                <div className="flex items-center space-x-1.5 px-3 py-1 border border-gray-200 rounded-lg bg-gray-50/50">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Trang</span>
                  <input 
                    type="number" 
                    className="w-10 text-center bg-transparent font-bold text-blue-600 focus:outline-none text-xs" 
                    value={pageInput} 
                    onChange={(e) => setPageInput(e.target.value)} 
                    onBlur={handlePageInputBlurOrEnter} 
                    onKeyDown={handlePageInputBlurOrEnter} 
                  />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">/ {totalPages}</span>
                </div>

                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all font-medium text-xs">Sau ›</button>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all font-medium text-xs">Cuối »</button>
              </div>
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}