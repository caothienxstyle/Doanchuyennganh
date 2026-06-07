import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import DataTable from "../components/DataTable";
import { getChiTietPhieuNhap } from "../services/phieuNhapService";

// 🌟 Import service Sản phẩm để lấy danh sách tra cứu MaSP
import { getProducts } from "../services/productService";

// 🌟 Import thêm service Nhà cung cấp để lấy danh sách đối chiếu Tên
import { getNhaCungCapList } from "../services/nhaCungCapService";

// 🌟 Import đúng Layout chung của hệ thống
import MainLayout from "../layouts/MainLayout";
import { ROLES } from "../services/auth";
import { Search, CheckCircle2, Clock, FileText, ArrowDownCircle, ArrowUpCircle, Loader2, ClipboardCheck } from "lucide-react";

const ApprovePage = () => {
  // Tab hiện tại: "NHAP" hoặc "XUAT"
  const [activeTab, setActiveTab] = useState("NHAP");

  const [pendingTickets, setPendingTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedPhieu, setSelectedPhieu] = useState(null);
  const [chiTietItems, setChiTietItems] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [viTriList, setViTriList] = useState([]);
  const [pendingCounts, setPendingCount] = useState({ NHAP: 0, XUAT: 0 });
  
  // 🌟 State lưu danh sách nhà cung cấp để map sang Tên chuẩn
  const [fullNccList, setFullNccList] = useState([]);
  
  // 🌟 State lưu danh sách sản phẩm để tra cứu MaSP
  const [allProducts, setAllProducts] = useState([]);

  // 🔢 CÁC STATE PHỤC VỤ TÌM KIẾM VÀ PHÂN TRANG
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState("1");

  const getToken = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
  const headers = { Authorization: `Bearer ${getToken()}` };

  // Tải danh mục vị trí kho
  const loadViTriKho = async () => {
    try {
      const res = await axios.get("http://localhost:3000/vitrikho/danhsach", { headers });
      if (res.data.success) setViTriList(res.data.data || []);
    } catch (err) {
      console.error("Lỗi tải vị trí:", err);
    }
  };

  // 🌟 Tải danh mục nhà cung cấp để lấy thông tin TenNCC
  const loadNhaCungCapDanhMuc = async () => {
    try {
      const data = await getNhaCungCapList();
      setFullNccList(data || []);
    } catch (err) {
      console.error("Lỗi tải danh mục nhà cung cấp:", err);
    }
  };

  // 🌟 Tải danh mục sản phẩm để lấy thông tin MaSP tự nhập
  const loadProducts = async () => {
    try {
      const data = await getProducts();
      setAllProducts(data || []);
    } catch (err) {
      console.error("Lỗi tải danh mục sản phẩm:", err);
    }
  };

  // Tải số lượng tồn đọng của cả 2 loại phiếu để hiển thị KPI
  const loadSummaryCounts = async () => {
    try {
      const [nhapRes, xuatRes] = await Promise.all([
        axios.get("http://localhost:3000/phieunhap/danhsach", { headers }),
        axios.get("http://localhost:3000/phieuxuat/danhsach", { headers })
      ]);
      
      const filterPending = (list) => (Array.isArray(list) ? list : []).filter(item => {
        const status = item.TrangThai || item.trangThai;
        return !(status && (status.trim() === "DaDuyet" || status.trim() === "Đã duyệt"));
      }).length;

      setPendingCount({
        NHAP: filterPending(nhapRes.data.data || nhapRes.data),
        XUAT: filterPending(xuatRes.data.data || xuatRes.data)
      });
    } catch (err) {
      console.error("Lỗi tải thống kê phê duyệt:", err);
    }
  };

  useEffect(() => {
    loadViTriKho();
    loadNhaCungCapDanhMuc();
    loadProducts();
    loadSummaryCounts();
  }, []);

  // 🚀 TẢI DANH SÁCH CHỜ DUYỆT (TỰ ĐỘNG THEO TAB)
  const loadPendingTickets = async (tab = activeTab) => {
    try {
      setLoading(true);
      const endpoint = tab === "NHAP" ? "/phieunhap/danhsach" : "/phieuxuat/danhsach";
      const res = await axios.get(`http://localhost:3000${endpoint}`, { headers });
      const actualList = res.data.data || res.data || [];

      const onlyPending = actualList.filter(item => {
        const status = item.TrangThai || item.trangThai;
        return !(status && (status.trim() === "DaDuyet" || status.trim() === "Đã duyệt"));
      });
      setPendingTickets(onlyPending);
    } catch (err) {
      console.error("Lỗi khi tải danh sách chờ duyệt:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingTickets(activeTab);
  }, [activeTab]);

  // 🚀 XỬ LÝ PHÊ DUYỆT PHIẾU
  const handleApprove = async (phieu) => {
    const formatMaPhieu = phieu.MaPhieu;
    if (!window.confirm(`Bạn có chắc chắn muốn phê duyệt phiếu ${formatMaPhieu}? Thao tác này sẽ trực tiếp cập nhật số lượng tồn kho!`)) return;
    
    try {
      const endpoint = activeTab === "NHAP" ? "/phieunhap/duyetphieu" : "/phieuxuat/duyetphieuxuat";
      const res = await axios.put(`http://localhost:3000${endpoint}`, 
        { MaPhieu: formatMaPhieu }, 
        { headers }
      );

      if (res.data.success) {
        alert(res.data.message || "Phê duyệt thành công!");
        loadSummaryCounts(); // Cập nhật KPI
        await loadPendingTickets(activeTab);
      } else {
        alert("Phê duyệt thất bại: " + res.data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Hệ thống gặp lỗi trong quá trình phê duyệt.");
    }
  };

  // 🚀 XEM CHI TIẾT SẢN PHẨM
  const handleViewDetail = async (row) => {
    try {
      setSelectedPhieu(row);
      setIsViewModalOpen(true);
      setLoadingDetail(true);

      if (activeTab === "NHAP") {
        const res = await getChiTietPhieuNhap(row.MaPhieuNhap);
        if (res.success) setChiTietItems(res.data || []);
      } else {
        const res = await axios.get(`http://localhost:3000/phieuxuat/chitiet/${row.MaPhieu}`, { headers });
        setChiTietItems(res.data.success ? res.data.data.ChiTiet : []);
      }
    } catch (err) {
      alert("Không thể lấy dữ liệu chi tiết: " + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "—";
    return new Intl.NumberFormat("vi-VN").format(amount) + " đ";
  };

  // 🔍 LOGIC XỬ LÝ LỌC / TÌM KIẾM THEO TỪ KHÓA ĐỐI VỚI PHIẾU CHỜ DUYỆT
  const filteredTickets = useMemo(() => {
    return pendingTickets.filter((phieu) => {
      const search = searchTerm.toLowerCase().trim();
      if (!search) return true;

      const maPhieuStr = String(phieu.MaPhieu || "").toLowerCase();
      
      // Tìm đối tượng nhà cung cấp tương ứng trong danh mục để lấy thông tin tìm kiếm
      const nccMatch = fullNccList.find(n => String(n.MaNCC) === String(phieu.MaNCC));
      const tenNccStr = nccMatch ? String(nccMatch.TenNCC).toLowerCase() : "";
      const codeNccStr = nccMatch ? String(nccMatch.MaNCCCode).toLowerCase() : "";

      const tenKhStr = String(phieu.TenKH || phieu.KhachHang || phieu.MaKH || "").toLowerCase();
      const doiTacStr = activeTab === "NHAP" ? `${tenNccStr} ${codeNccStr}` : tenKhStr;

      return maPhieuStr.includes(search) || doiTacStr.includes(search);
    });
  }, [pendingTickets, searchTerm, fullNccList, activeTab]);

  // 🔢 TÍNH TOÁN PHÂN TRANG (PAGINATION) DỰA TRÊN DỮ LIỆU ĐÃ LỌC
  const totalItems = filteredTickets.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPaginatedTickets = useMemo(() => {
    return filteredTickets.slice(indexOfFirstItem, indexOfLastItem);
  }, [filteredTickets, indexOfFirstItem, indexOfLastItem]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Reset trang khi tìm kiếm hoặc đổi tab
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, activeTab]);

  const handlePageInputChange = (e) => {
    setPageInput(e.target.value);
  };

  const handlePageInputBlurOrEnter = (e) => {
    if (e.key && e.key !== "Enter") return;

    let targetPage = parseInt(pageInput, 10);
    if (isNaN(targetPage)) {
      setPageInput(String(currentPage));
      return;
    }

    if (targetPage < 1) targetPage = 1;
    if (targetPage > totalPages) targetPage = totalPages;

    setCurrentPage(targetPage);
    setPageInput(String(targetPage));
  };

  return (
    <MainLayout role={ROLES.manager}>
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Phê duyệt Chứng từ</h2>
          <p className="text-sm text-gray-400 mt-1">Kiểm soát và xác nhận các lệnh nhập xuất kho vật tư</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 p-1.5 rounded-2xl shadow-xs">
          <button
            onClick={() => setActiveTab("NHAP")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "NHAP" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <ArrowDownCircle size={14}/> Phiếu Nhập
          </button>
          <button
            onClick={() => setActiveTab("XUAT")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "XUAT" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <ArrowUpCircle size={14}/> Phiếu Xuất
          </button>
        </div>
      </div>

      {/* KPI STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div 
          onClick={() => setActiveTab("NHAP")}
          className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-5 rounded-2xl border flex items-center gap-4 shadow-sm ${activeTab === "NHAP" ? "border-blue-500 ring-2 ring-blue-500/10 shadow-md" : "border-gray-100 hover:border-blue-200"}`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${activeTab === "NHAP" ? "bg-blue-600 text-white shadow-xs" : "bg-blue-50 text-blue-600 shadow-xs"}`}><ArrowDownCircle size={24}/></div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phiếu Nhập Chờ Duyệt</p>
            <h3 className="text-2xl font-bold text-gray-800">{pendingCounts.NHAP} <span className="text-xs font-normal text-gray-400">Phiếu</span></h3>
          </div>
        </div>
        <div 
          onClick={() => setActiveTab("XUAT")}
          className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-5 rounded-2xl border flex items-center gap-4 shadow-sm ${activeTab === "XUAT" ? "border-orange-500 ring-2 ring-orange-500/10 shadow-md" : "border-gray-100 hover:border-orange-200"}`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${activeTab === "XUAT" ? "bg-orange-600 text-white shadow-xs" : "bg-orange-50 text-orange-600 shadow-xs"}`}><ArrowUpCircle size={24}/></div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phiếu Xuất Chờ Duyệt</p>
            <h3 className="text-2xl font-bold text-gray-800">{pendingCounts.XUAT} <span className="text-xs font-normal text-gray-400">Phiếu</span></h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-xs"><ClipboardCheck size={24}/></div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Chứng từ tồn đọng</p>
            <h3 className="text-2xl font-bold text-emerald-600">{pendingCounts.NHAP + pendingCounts.XUAT}</h3>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 relative">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tìm kiếm nhanh</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
              <input
                type="text"
                placeholder={activeTab === "NHAP" ? "Tìm mã phiếu, nhà cung cấp..." : "Tìm mã phiếu, khách hàng..."}
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
              <option value={10}>10 phiếu / trang</option>
              <option value={20}>20 phiếu / trang</option>
              <option value={50}>50 phiếu / trang</option>
            </select>
          </div>
        </div>
      </div>

      {loading && pendingTickets.length === 0 ? (
        <div className="flex items-center justify-center p-12 text-gray-400 animate-pulse font-medium">⏳ Đang tải danh sách dữ liệu chờ duyệt...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <DataTable
            columns={[
              { key: "MaPhieu", label: "Mã phiếu", render: (v) => <span className="font-mono font-bold text-gray-900">{v}</span> },
              { 
                key: "DoiTac", 
                label: activeTab === "NHAP" ? "Nhà cung cấp" : "Khách hàng / Bộ phận",
                render: (_, row) => {
                  if (activeTab === "NHAP") {
                    const doiTacNCC = fullNccList.find((n) => String(n.MaNCC) === String(row.MaNCC));
                    return <span className="font-medium text-gray-800">{doiTacNCC ? doiTacNCC.TenNCC : (row.TenNCC || row.NhaCungCap || `NCC #${row.MaNCC}`)}</span>;
                  }
                  return <span className="font-medium text-gray-800">{row.TenKH || row.KhachHang || `KH #${row.MaKH}`}</span>;
                }
              },
              { 
                key: "Ngay", 
                label: (
                  <div className="flex items-center gap-1.5">
                    <Clock size={14}/> {activeTab === "NHAP" ? "Ngày nhập" : "Ngày xuất"}
                  </div>
                ),
                render: (_, row) => {
                  const date = activeTab === "NHAP" ? row.NgayNhap : row.NgayXuat;
                  return <span className="text-gray-500">{date ? new Date(date).toLocaleDateString("vi-VN") : "—"}</span>;
                }
              },
              { key: "TongTien", label: "Tổng tiền", render: (v) => <span className="font-medium text-gray-800">{formatCurrency(v)}</span> },
              { key: "TrangThai", label: "Trạng thái", render: () => <span className="bg-orange-50 text-orange-500 px-3 py-1 rounded-full text-[10px] font-bold border border-orange-100 uppercase">Chờ duyệt</span> },
              {
                key: "actions",
                label: "Hành động",
                render: (_, row) => (
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleViewDetail(row)} className="text-blue-600 hover:text-blue-700 bg-blue-50/60 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Xem hàng</button>
                    <button onClick={() => handleApprove(row)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all">Duyệt</button>
                  </div>
                ),
              },
            ]}
            data={currentPaginatedTickets}
          />
          {filteredTickets.length === 0 && (
            <div className="p-12 text-center text-gray-400 text-sm italic">📭 Hiện tại không có kết quả phù hợp nào đang chờ phê duyệt.</div>
          )}
        </div>
      )}

      {/* PAGINATION NAVIGATION */}
      {!loading && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-500">
          <div>
            Hiển thị <span className="font-bold text-gray-800">{indexOfFirstItem + 1}</span> -{" "}
            <span className="font-bold text-gray-800">{Math.min(indexOfLastItem, totalItems)}</span> trên{" "}
            <span className="font-bold text-gray-800">{totalItems}</span> phiếu
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

      {/* MODAL CHI TIẾT SẢN PHẨM (ĐÃ ĐƯỢC KÉO RỘNG VÀ TỐI ƯU LAYOUT) */}
      {isViewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-100 flex flex-col my-auto max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="px-6 py-5 bg-gray-50/90 border-b border-gray-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-gray-800 text-xl flex items-center gap-2">
                  {activeTab === "NHAP" ? "📥 Danh Sách Vật Tư Vào Kho" : "📤 Danh Sách Vật Tư Xuất Kho"}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Mã chứng từ: <span className="font-mono font-bold text-gray-700 bg-gray-200/60 px-1.5 py-0.5 rounded text-xs">{selectedPhieu?.MaPhieu}</span>
                </p>
              </div>
              <button 
                onClick={() => setIsViewModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 text-3xl font-light w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-all duration-200"
              >
                &times;
              </button>
            </div>

            {/* Nội dung bảng chi tiết */}
            <div className="p-6 overflow-y-auto grow">
              {loadingDetail ? (
                <div className="py-12 text-center text-gray-400 font-medium flex flex-col items-center justify-center gap-2">
                  <span className="animate-spin text-xl text-blue-500">⏳</span> Đang tải chi tiết vật tư hệ thống...
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-100 rounded-xl shadow-sm">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase font-bold tracking-wider border-b border-gray-100">
                        <th className="p-4 pl-5 w-[15%]">Mã sản phẩm</th>
                        <th className="p-4 w-[30%]">Tên Sản Phẩm</th>
                        <th className="p-4 text-center w-[18%]">Hạn Sử Dụng (NSX)</th>
                        <th className="p-4 text-center w-[12%]">Số lượng</th>
                        <th className="p-4 text-center w-[12%]">Sơ đồ vị trí</th>
                        <th className="p-4 text-right pr-5 w-[13%]">
                          {activeTab === "NHAP" ? "Giá nhập" : "Giá xuất"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {chiTietItems.map((item, index) => {
                        const formatDate = (val) => {
                          if (!val || String(val).startsWith("0001") || String(val).startsWith("1900") || val === "null") return "—";
                          const d = new Date(val);
                          return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN");
                        };

                        const nsxStr = formatDate(item.NgaySanXuat || item.ngaySanXuat || item.nsx || item.NSX || item.NgaySX);
                        const hsdStr = formatDate(item.HanSuDung || item.hanSuDung || item.hsd || item.HSD || item.HanSD);

                        const maViTri = item.MaViTriCode || item.mavitricode || item.MaViTri || item.mavitri || "";
                        const soDoTuItem = [item.KhuVuc, item.DayKe, item.Tang, item.OKe].filter(val => val !== null && val !== undefined && val !== "" && val !== 0).join(" / ");
                        const vtLocal = !soDoTuItem ? viTriList.find(v => String(v.MaViTriCode || v.mavitricode) === String(maViTri)) : null;
                        const soDo = soDoTuItem || (vtLocal ? (vtLocal.TenViTriHienThi || `${vtLocal.KhuVuc} / ${vtLocal.DayKe} / ${vtLocal.Tang}`) : (maViTri || "—"));

                        // 🌟 Tìm kiếm thông tin sản phẩm để lấy MaSP (mã tự nhập) thay vì ID hệ thống
                        const productInfo = allProducts.find(p => String(p.id || p.MaSanPham || p.masanpham) === String(item.MaSanPham || item.masanpham));
                        const displayMaSP = productInfo?.MaSP || productInfo?.code || item.MaSP || item.MaSanPham || item.masanpham || "—";
                        const displayTenSP = item.TenSanPham || item.tensanpham || productInfo?.name || productInfo?.TenSanPham || `Sản phẩm #${item.MaSanPham}`;

                        return (
                          <tr key={index} className="hover:bg-blue-50/20 transition-colors">
                            <td className="p-4 pl-5">
                              <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                {displayMaSP}
                              </span>
                            </td>
                            <td className="p-4">
                              <p className="font-bold text-gray-800 text-sm leading-tight">{displayTenSP}</p>
                            </td>
                            <td className="p-4 text-center">
                              <div className="text-[10px] text-gray-400 uppercase font-medium">Hạn sử dụng</div>
                              <div className="whitespace-nowrap font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md mt-0.5 inline-block text-xs border border-amber-100">
                                {hsdStr}
                              </div>
                            </td>
                            <td className={`p-4 text-center font-black text-base ${activeTab === "NHAP" ? "text-emerald-600" : "text-orange-600"}`}>
                              {new Intl.NumberFormat("vi-VN").format(item.SoLuong || 0)}
                            </td>
                            <td className="p-4 text-center">
                              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded uppercase tracking-wider block truncate max-w-[120px] mx-auto border border-gray-200">
                                {soDo}
                              </span>
                            </td>
                            <td className="p-4 text-right font-bold text-gray-800 pr-5 text-sm">
                              {formatCurrency(item.DonGia || 0)}
                            </td>
                          </tr>
                        );
                      })}
                      {chiTietItems.length === 0 && (
                        <tr>
                          <td colSpan="6" className="p-12 text-center text-gray-400 italic bg-gray-50/30 font-medium">
                            ❌ Phiếu này hiện chưa có danh sách hàng hóa chi tiết!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <button 
                type="button" 
                onClick={() => setIsViewModalOpen(false)}
                className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors"
              >
                Đóng lại
              </button>
            </div>

          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default ApprovePage;