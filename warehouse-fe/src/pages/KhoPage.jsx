import { useState, useEffect, useMemo } from "react";
import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable";
import { getCurrentRole, ROLES } from "../services/auth";
import { Search, Warehouse, MapPin, CheckCircle2, FilePlus, Loader2 } from "lucide-react";

const KhoPage = () => {
  const role = getCurrentRole() || ROLES.staff;
  const canManageKho = role === ROLES.manager || role === ROLES.admin;

  // Tab hiện tại: "KHO" hoặc "VITRI" giống cấu trúc ApprovePage
  const [activeTab, setActiveTab] = useState("KHO");

  // States Quản Lý Kho
  const [khoList, setKhoList] = useState([]);
  const [loadingKho, setLoadingKho] = useState(false);
  const [currentKho, setCurrentKho] = useState(null); // Lưu kho đang chọn để sửa

  // States Quản Lý Vị Trí
  const [viTriList, setViTriList] = useState([]);
  const [loadingViTri, setLoadingViTri] = useState(false);
  const [currentViTri, setCurrentViTri] = useState(null); // Lưu vị trí đang chọn để sửa

  // States Điều Khiển Modal (Thêm / Sửa)
  const [isKhoModalOpen, setIsKhoModalOpen] = useState(false);
  const [isViTriModalOpen, setIsViTriModalOpen] = useState(false);

  // Form States cho Kho
  const [formKho, setFormKho] = useState({ TenKho: "", DiaChi: "", MoTa: "" });
  
  // Form States cho Vị Trí
  const [formViTri, setFormViTri] = useState({
    MaKho: "", MaViTriCode: "", KhuVuc: "", DayKe: "", Tang: "", OKe: "", MoTa: ""
  });

  // 🔢 Tìm Kiếm & Phân Trang (Thừa hưởng từ ApprovePage)
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState("1");

  // Hàm lấy Token an toàn
  const getToken = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";

  // 🚀 FETCH API: DANH SÁCH KHO
  const loadDanhSachKho = async () => {
    try {
      setLoadingKho(true);
      const token = getToken();
      const response = await fetch("http://localhost:3000/kho/danhsach", {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const res = await response.json();
      if (res.success) setKhoList(res.data || []);
    } catch (err) {
      console.error("Lỗi tải danh sách kho:", err);
    } finally {
      setLoadingKho(false);
    }
  };

  // 🚀 FETCH API: DANH SÁCH VỊ TRÍ KHO
  const loadDanhSachViTri = async () => {
    try {
      setLoadingViTri(true);
      const token = getToken();
      const response = await fetch("http://localhost:3000/vitrikho/danhsach", {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const res = await response.json();
      if (res.success) setViTriList(res.data || []);
    } catch (err) {
      console.error("Lỗi tải vị trí kho:", err);
    } finally {
      setLoadingViTri(false);
    }
  };

  useEffect(() => {
    loadDanhSachKho();
    loadDanhSachViTri();
  }, []);

  // Reset phân trang khi đổi tab hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, activeTab]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // ⚙️ THAO TÁC NGHIỆP VỤ KHO (CRUD)
  const handleOpenKhoModal = (kho = null) => {
    if (kho) {
      setCurrentKho(kho);
      setFormKho({ TenKho: kho.TenKho || "", DiaChi: kho.DiaChi || "", MoTa: kho.MoTa || "" });
    } else {
      setCurrentKho(null);
      setFormKho({ TenKho: "", DiaChi: "", MoTa: "" });
    }
    setIsKhoModalOpen(true);
  };

  const handleSaveKho = async (e) => {
    e.preventDefault();
    if (!formKho.TenKho.trim()) return alert("Tên kho là bắt buộc!");

    try {
      const token = getToken();
      const isEdit = !!currentKho;
      const url = isEdit 
        ? `http://localhost:3000/kho/capnhat/${currentKho.MaKho}`
        : "http://localhost:3000/kho/taomoi";
      
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(formKho)
      });
      const res = await response.json();

      if (res.success) {
        alert(res.message || "Lưu thông tin kho thành công!");
        setIsKhoModalOpen(false);
        loadDanhSachKho();
      } else {
        alert("Thất bại: " + res.message);
      }
    } catch (err) {
      console.error(err);
      alert("Hệ thống xảy ra lỗi khi lưu kho.");
    }
  };

  const handleDeleteKho = async (id, name) => {
    if (!window.confirm(`Bạn chắc chắn muốn xóa kho "${name}"?`)) return;
    try {
      const token = getToken();
      const response = await fetch(`http://localhost:3000/kho/xoa/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const res = await response.json();
      if (res.success) {
        alert("Xóa kho thành công!");
        loadDanhSachKho();
      } else {
        alert("Xóa thất bại: " + res.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ⚙️ THAO TÁC NGHIỆP VỤ VỊ TRÍ KHO (CRUD)
  const handleOpenViTriModal = (vitri = null) => {
    if (vitri) {
      setCurrentViTri(vitri);
      setFormViTri({
        MaKho: vitri.MaKho || "",
        MaViTriCode: vitri.MaViTriCode || "",
        KhuVuc: vitri.KhuVuc || "",
        DayKe: vitri.DayKe || "",
        Tang: vitri.Tang || "",
        OKe: vitri.OKe || "",
        MoTa: vitri.MoTa || ""
      });
    } else {
      setCurrentViTri(null);
      setFormViTri({ MaKho: khoList[0]?.MaKho || "", MaViTriCode: "", KhuVuc: "", DayKe: "", Tang: "", OKe: "", MoTa: "" });
    }
    setIsViTriModalOpen(true);
  };

  const handleSaveViTri = async (e) => {
    e.preventDefault();
    if (!formViTri.MaKho || !formViTri.MaViTriCode.trim()) {
      return alert("Vui lòng chọn Kho và nhập Mã Vị Trí Code định danh!");
    }

    try {
      const token = getToken();
      const isEdit = !!currentViTri;
      const url = isEdit 
        ? `http://localhost:3000/vitrikho/capnhat/${currentViTri.MaViTri}`
        : "http://localhost:3000/vitrikho/taomoi";

      // Chuẩn hóa dữ liệu gửi lên (PUT không được đổi mã theo luật của BE)
      const payload = isEdit 
        ? { KhuVuc: formViTri.KhuVuc, DayKe: formViTri.DayKe, Tang: formViTri.Tang, OKe: formViTri.OKe, MoTa: formViTri.MoTa }
        : formViTri;

      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const res = await response.json();

      if (res.success) {
        alert(res.message || "Lưu vị trí thành công!");
        setIsViTriModalOpen(false);
        loadDanhSachViTri();
      } else {
        alert("Thất bại: " + res.message);
      }
    } catch (err) {
      console.error(err);
      alert("Hệ thống xảy ra lỗi khi lưu vị trí.");
    }
  };

  const handleDeleteViTri = async (id, code) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa mã vị trí [${code}]? Hệ thống sẽ kiểm tra ràng buộc hàng tồn kho.`)) return;
    try {
      const token = getToken();
      const response = await fetch(`http://localhost:3000/vitrikho/xoa/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const res = await response.json();
      if (res.success) {
        alert("Xóa vị trí thành công!");
        loadDanhSachViTri();
      } else {
        alert("Không thể xóa: " + res.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 🔍 LOGIC LỌC TÌM KIẾM THEO TAB
  const filteredData = (activeTab === "KHO" ? khoList : viTriList).filter((item) => {
    const search = searchTerm.toLowerCase().trim();
    if (!search) return true;
    if (activeTab === "KHO") {
      return String(item.TenKho || "").toLowerCase().includes(search) || 
             String(item.DiaChi || "").toLowerCase().includes(search);
    } else {
      return String(item.MaViTriCode || "").toLowerCase().includes(search) ||
             String(item.TenKho || "").toLowerCase().includes(search) ||
             String(item.TenViTriHienThi || "").toLowerCase().includes(search);
    }
  });

  // 🔢 TÍNH TOÁN PHÂN TRANG CHUẨN
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPaginatedData = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageInputBlurOrEnter = (e) => {
    if (e.key && e.key !== "Enter") return;
    let targetPage = parseInt(pageInput, 10);
    if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
    if (targetPage > totalPages) targetPage = totalPages;
    setCurrentPage(targetPage);
    setPageInput(String(targetPage));
  };

  // ==========================================
  // CẤU HÌNH CỘT CHO DATATABLE
  // ==========================================
  const khoColumns = [
    { key: "MaKho", label: "Mã Kho", render: (v) => <span className="font-mono font-bold text-gray-400 text-xs">KHO-0{v}</span> },
    { key: "TenKho", label: "Tên Tổng Kho", render: (v) => <span className="font-bold text-gray-800 text-sm">{v}</span> },
    { key: "DiaChi", label: "Địa Chỉ Cơ Sở", render: (v) => <span className="text-gray-500 text-xs">{v || "—"}</span> },
    { key: "MoTa", label: "Ghi chú", render: (v) => <span className="text-[11px] italic text-gray-400">{v || "Không có"}</span> },
    {
      key: "actions",
      label: "Hành động",
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button onClick={() => handleOpenKhoModal(row)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors">Sửa</button>
          <button onClick={() => handleDeleteKho(row.MaKho, row.TenKho)} className="text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors">Xóa</button>
        </div>
      )
    }
  ];

  const viTriColumns = [
    { key: "MaViTriCode", label: "Mã Vị Trí", render: (v) => <span className="font-mono font-bold text-indigo-600 text-xs bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{v}</span> },
    { key: "TenKho", label: "Thuộc Kho", render: (v) => <span className="font-medium text-gray-700 text-xs">{v}</span> },
    { 
      key: "TenViTriHienThi", 
      label: "Sơ Đồ Tọa Độ", 
      render: (v, row) => (
        <span className="text-[10px] font-bold text-blue-600 bg-blue-50/80 px-3 py-1 rounded-lg border border-blue-100 tracking-wide">
          {v || `${row.KhuVuc} / ${row.DayKe} / ${row.Tang} / ${row.OKe}`}
        </span>
      )
    },
    { 
      key: "Details", 
      label: "Chi Tiết Tách Khối", 
      render: (_, row) => (
        <div className="text-[10px] text-gray-500 flex gap-1">
          <span className="bg-gray-100 rounded px-1.5 py-0.5">Khu: {row.KhuVuc || "—"}</span>
          <span className="bg-gray-100 rounded px-1.5 py-0.5">Kệ: {row.DayKe || "—"}</span>
          <span className="bg-gray-100 rounded px-1.5 py-0.5">Tầng: {row.Tang || "—"}</span>
        </div>
      )
    },
    {
      key: "actions",
      label: "Thao tác",
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button onClick={() => handleOpenViTriModal(row)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors">Sửa vị trí</button>
          <button onClick={() => handleDeleteViTri(row.MaViTri, row.MaViTriCode)} className="text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors">Xóa</button>
        </div>
      )
    }
  ];

  return (
    <MainLayout role={role}>
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Cấu hình hạ tầng kho</h2>
          <p className="text-sm text-gray-400 mt-1">Quản lý trung tâm lưu trữ và định vị sơ đồ ô kệ chứa hàng</p>
        </div>
        <button
          onClick={() => activeTab === "KHO" ? handleOpenKhoModal() : handleOpenViTriModal()}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-white text-sm hover:bg-blue-700 font-bold transition-all shadow-md flex items-center gap-2"
        >
          <FilePlus size={18}/> {activeTab === "KHO" ? "Tạo kho mới" : "Thêm vị trí mới"}
        </button>
      </div>

      {/* KPI STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div 
          onClick={() => setActiveTab("KHO")}
          className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-5 rounded-3xl border flex items-center gap-4 shadow-sm ${activeTab === "KHO" ? "border-blue-500 ring-4 ring-blue-500/5 shadow-md" : "border-gray-100 hover:border-blue-200"}`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${activeTab === "KHO" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}>
            <Warehouse size={24}/>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Tổng số kho</p>
            <h3 className="text-2xl font-black text-gray-800 leading-none">{khoList.length} <span className="text-xs font-medium text-gray-400 font-sans ml-1">Cơ sở</span></h3>
          </div>
        </div>

        <div 
          onClick={() => setActiveTab("VITRI")}
          className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-5 rounded-3xl border flex items-center gap-4 shadow-sm ${activeTab === "VITRI" ? "border-indigo-500 ring-4 ring-indigo-500/5 shadow-md" : "border-gray-100 hover:border-indigo-200"}`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${activeTab === "VITRI" ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"}`}>
            <MapPin size={24}/>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Tổng số vị trí kệ</p>
            <h3 className="text-2xl font-black text-gray-800 leading-none">{viTriList.length} <span className="text-xs font-medium text-gray-400 font-sans ml-1">Vị trí</span></h3>
          </div>
        </div>

        {/* Thẻ thứ 3 giúp layout đầy đặn và chuyên nghiệp hơn */}
        <div 
          onClick={() => setSearchTerm("")}
          className="cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-5 rounded-3xl border border-gray-100 flex items-center gap-4 shadow-sm hover:border-emerald-200 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <CheckCircle2 size={24}/>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Hệ thống</p>
            <h3 className="text-sm font-bold text-emerald-600 uppercase">Sẵn sàng vận hành</h3>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex space-x-2 mb-4 bg-gray-100 p-1.5 rounded-xl max-w-sm">
        <button
          onClick={() => setActiveTab("KHO")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "KHO" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          🏢 Danh Sách Kho
        </button>
        <button
          onClick={() => setActiveTab("VITRI")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "VITRI" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          📍 Sơ Đồ Vị Trí
        </button>
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
                placeholder={activeTab === "KHO" ? "Tìm mã kho, tên kho, địa chỉ..." : "Tìm mã vị trí, thuộc kho, khu vực..."}
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
              <option value={10}>10 bản ghi / trang</option>
              <option value={20}>20 bản ghi / trang</option>
              <option value={50}>50 bản ghi / trang</option>
            </select>
          </div>
        </div>
      </div>

      {(loadingKho || loadingViTri) && <div className="flex items-center justify-center p-12 text-gray-400 animate-pulse">⏳ Đang đồng bộ sơ đồ kho bãi...</div>}

      {!(loadingKho || loadingViTri) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <DataTable 
            columns={activeTab === "KHO" ? khoColumns : viTriColumns} 
            data={currentPaginatedData} 
          />
          {filteredData.length === 0 && (
            <div className="p-12 text-center text-gray-400 text-sm italic">📭 Không tìm thấy kết quả phù hợp cho sơ đồ kho này.</div>
          )}
        </div>
      )}

      {/* PAGINATION NAVIGATION */}
      {!(loadingKho || loadingViTri) && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-500">
          <div>
            Hiển thị <span className="font-bold text-gray-800">{indexOfFirstItem + 1}</span> -{" "}
            <span className="font-bold text-gray-800">{Math.min(indexOfLastItem, totalItems)}</span> trên{" "}
            <span className="font-bold text-gray-800">{totalItems}</span> kết quả
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

      {/* 📄 MODAL 1: THÊM / CẬP NHẬT KHO (Rộng rãi max-w-4xl) */}
      {isKhoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 flex flex-col">
            <div className="px-6 py-5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-xl">
                {currentKho ? "✏️ Cập Nhật Thông Tin Kho" : "🏢 Tạo Trung Tâm Kho Mới"}
              </h3>
              <button onClick={() => setIsKhoModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            
            <form onSubmit={handleSaveKho}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tên Tổng Kho <span className="text-red-500">*</span></label>
                  <input
                    type="text" required placeholder="Ví dụ: Kho Tổng A, Kho Cận Date..."
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                    value={formKho.TenKho}
                    onChange={(e) => setFormKho({ ...formKho, TenKho: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Địa Chỉ</label>
                  <input
                    type="text" placeholder="Nhập địa chỉ vị trí địa lý của kho"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                    value={formKho.DiaChi}
                    onChange={(e) => setFormKho({ ...formKho, DiaChi: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mô Tả / Ghi Chú</label>
                  <textarea
                    placeholder="Ghi chú công năng kho..." rows="3"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                    value={formKho.MoTa}
                    onChange={(e) => setFormKho({ ...formKho, MoTa: e.target.value })}
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-2">
                <button type="button" onClick={() => setIsKhoModalOpen(false)} className="px-4 py-2 border rounded-xl text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50">Hủy</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm">Lưu Dữ Liệu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📄 MODAL 2: THÊM / CẬP NHẬT VỊ TRÍ KHO (Kéo to chuẩn max-w-4xl) */}
      {isViTriModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col">
            <div className="px-6 py-5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-xl">
                {currentViTri ? "✏️ Hiệu Chỉnh Tọa Độ Ô Chứa" : "📍 Định Vị Tọa Độ Ô Kho Mới"}
              </h3>
              <button onClick={() => setIsViTriModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <form onSubmit={handleSaveViTri}>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Thuộc Tổng Kho <span className="text-red-500">*</span></label>
                    <select
                      disabled={!!currentViTri} // BE cấm đổi cơ sở kho khi cập nhật vị trí
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 text-sm bg-white disabled:bg-gray-100 font-medium"
                      value={formViTri.MaKho}
                      onChange={(e) => setFormViTri({ ...formViTri, MaKho: Number(e.target.value) })}
                    >
                      {khoList.map(k => <option key={k.MaKho} value={k.MaKho}>{k.TenKho}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Mã Vị Trí Code (Định danh) <span className="text-red-500">*</span></label>
                    <input
                      type="text" required placeholder="Ví dụ: VT-A-01" disabled={!!currentViTri} // BE cấm đổi mã định danh
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 text-sm font-mono font-bold uppercase disabled:bg-gray-100"
                      value={formViTri.MaViTriCode}
                      onChange={(e) => setFormViTri({ ...formViTri, MaViTriCode: e.target.value })}
                    />
                  </div>
                </div>

                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-blue-700 mb-1">Khu Vực (Khu)</label>
                    <input
                      type="text" placeholder="A, B, C..." className="w-full px-2.5 py-1.5 border rounded-md text-sm font-bold text-center"
                      value={formViTri.KhuVuc} onChange={(e) => setFormViTri({ ...formViTri, KhuVuc: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-700 mb-1">Dãy Kệ (Kệ)</label>
                    <input
                      type="text" placeholder="D1, D2..." className="w-full px-2.5 py-1.5 border rounded-md text-sm font-bold text-center"
                      value={formViTri.DayKe} onChange={(e) => setFormViTri({ ...formViTri, DayKe: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-700 mb-1">Tầng Số (Tầng)</label>
                    <input
                      type="text" placeholder="T1, T2..." className="w-full px-2.5 py-1.5 border rounded-md text-sm font-bold text-center"
                      value={formViTri.Tang} onChange={(e) => setFormViTri({ ...formViTri, Tang: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-700 mb-1">Ô Kệ (Ô)</label>
                    <input
                      type="text" placeholder="O1, O2..." className="w-full px-2.5 py-1.5 border rounded-md text-sm font-bold text-center"
                      value={formViTri.OKe} onChange={(e) => setFormViTri({ ...formViTri, OKe: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mô Tả Vị Trí Chỉ Định</label>
                  <input
                    type="text" placeholder="Ví dụ: Kệ trung tâm sát cửa cuốn xuất hàng"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                    value={formViTri.MoTa}
                    onChange={(e) => setFormViTri({ ...formViTri, MoTa: e.target.value })}
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-2">
                <button type="button" onClick={() => setIsViTriModalOpen(false)} className="px-4 py-2 border rounded-xl text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50">Hủy mụ</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm">Lưu Định Vị</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </MainLayout>
  );
};

export default KhoPage;
