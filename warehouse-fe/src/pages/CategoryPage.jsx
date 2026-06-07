import { useState, useEffect, useMemo } from "react";
import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { Search, FolderTree, Scale, CheckCircle2, FilePlus } from "lucide-react";
import { getCurrentRole, ROLES } from "../services/auth";
import axios from "axios";

const EMPTY_CATEGORY_FORM = { maDanhMuc: "", tenDanhMuc: "", moTa: "" };
const EMPTY_UNIT_FORM = { maDonVi: "", tenDonVi: "", moTaUnit: "" };

export default function CategoryPage() {
  const role = getCurrentRole();
  const canManage = role === ROLES.manager || role === ROLES.admin;

  // State Quản lý Tab chính: "CATEGORY" hoặc "UNIT"
  const [activeTab, setActiveTab] = useState("CATEGORY");

  // 🔢 Trạng thái Phân trang & Tìm kiếm
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState("1");

  // State dữ liệu danh sách
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // State quản lý Modal và trạng thái Form
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // Lưu Object đang sửa (Danh mục hoặc ĐVT)
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [unitForm, setUnitForm] = useState(EMPTY_UNIT_FORM);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==========================================
  // CALL API LOGIC
  // ==========================================
  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // Gọi song song cả 2 API lấy dữ liệu hệ thống
      const [resCat, resUnit] = await Promise.all([
        axios.get("http://localhost:3000/danhmuc/danhsach", { headers }),
        axios.get("http://localhost:3000/donvitinh/danhsachdonvitinh", { headers })
      ]);

      if (resCat.data?.success) setCategories(resCat.data.data);
      if (resUnit.data?.success) setUnits(resUnit.data.data);
    } catch (err) {
      setError("Không thể tải danh sách dữ liệu từ hệ thống.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 🔄 Tự động reset trang khi tìm kiếm, đổi tab hoặc thay đổi số lượng hiển thị
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, itemsPerPage]);

  // Đồng bộ ô nhập trang
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // 🔍 LOGIC LỌC DỮ LIỆU THÔNG MINH
  const filteredList = useMemo(() => {
    const list = activeTab === "CATEGORY" ? categories : units;
    const search = searchTerm.toLowerCase().trim();
    if (!search) return list;

    return list.filter((item) => {
      const name = (activeTab === "CATEGORY" ? item.TenDanhMuc : item.TenDonVi) || "";
      const description = (item.MoTa || item.moTaUnit || "").toLowerCase();
      const code = String(activeTab === "CATEGORY" ? item.MaDanhMuc : item.MaDonVi);
      
      return name.toLowerCase().includes(search) || 
             description.includes(search) ||
             code.includes(search);
    });
  }, [activeTab, categories, units, searchTerm]);

  // 🔢 TOÁN TỬ PHÂN TRANG
  const totalItems = filteredList.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedList = filteredList.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageInputBlurOrEnter = (e) => {
    if (e.key && e.key !== "Enter") return;
    let targetPage = parseInt(pageInput, 10);
    if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
    if (targetPage > totalPages) targetPage = totalPages;
    setCurrentPage(targetPage);
    setPageInput(String(targetPage));
  };

  // Control đóng mở và reset dữ liệu Modal Form
  const handleCloseModal = () => {
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setUnitForm(EMPTY_UNIT_FORM);
    setFormError("");
    setEditingItem(null);
    setModalOpen(false);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setUnitForm(EMPTY_UNIT_FORM);
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormError("");
    if (activeTab === "CATEGORY") {
      setCategoryForm({
        maDanhMuc: item.MaDanhMuc,
        tenDanhMuc: item.TenDanhMuc || "",
        moTa: item.MoTa || ""
      });
    } else {
      setUnitForm({
        maDonVi: item.MaDonVi,
        tenDonVi: item.TenDonVi || "",
        moTaUnit: item.MoTa || ""
      });
    }
    setModalOpen(true);
  };

  // Handler xử lý thay đổi input trên Form
  const handleCategoryInputChange = (e) => {
    const { name, value } = e.target;
    setCategoryForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUnitInputChange = (e) => {
    const { name, value } = e.target;
    setUnitForm((prev) => ({ ...prev, [name]: value }));
  };

  // ==========================================
  // XỬ LÝ SUBMIT FORM (THÊM / SỬA)
  // ==========================================
  const handleSubmit = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}` };

    try {
      setIsSubmitting(true);
      setFormError("");

      if (activeTab === "CATEGORY") {
        // --- XỬ LÝ CHO DANH MỤC ---
        if (!categoryForm.tenDanhMuc.trim()) {
          setFormError("Vui lòng nhập tên danh mục.");
          return;
        }

        if (editingItem) {
          await axios.put("http://localhost:3000/danhmuc/capnhat", {
            MaDanhMuc: categoryForm.maDanhMuc,
            TenDanhMuc: categoryForm.tenDanhMuc.trim(),
            MoTa: categoryForm.moTa.trim()
          }, { headers });
        } else {
          await axios.post("http://localhost:3000/danhmuc/themdanhmuc", {
            TenDanhMuc: categoryForm.tenDanhMuc.trim(),
            MoTa: categoryForm.moTa.trim()
          }, { headers });
        }
      } else {
        // --- XỬ LÝ CHO ĐƠN VỊ TÍNH ---
        if (!unitForm.tenDonVi.trim()) {
          setFormError("Vui lòng nhập tên đơn vị tính.");
          return;
        }

        if (editingItem) {
          // Khớp chuẩn Route Backend: /sua/:id
          await axios.put(`http://localhost:3000/donvitinh/sua/${unitForm.maDonVi}`, {
            TenDonVi: unitForm.tenDonVi.trim(),
            MoTa: unitForm.moTaUnit.trim()
          }, { headers });
        } else {
          // Khớp chuẩn Route Backend: /them
          await axios.post("http://localhost:3000/donvitinh/them", {
            TenDonVi: unitForm.tenDonVi.trim(),
            MoTa: unitForm.moTaUnit.trim()
          }, { headers });
        }
      }

      await fetchData(); // Đồng bộ tải lại giao diện dữ liệu mới nhất
      handleCloseModal();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Không thể lưu dữ liệu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // XỬ LÝ LOGIC XÓA DỮ LIỆU
  // ==========================================
  const handleDeleteItem = async (id, name) => {
    const itemTypeName = activeTab === "CATEGORY" ? "danh mục" : "đơn vị tính";
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${itemTypeName} "${name}" này không?`)) return;

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      if (activeTab === "CATEGORY") {
        const response = await axios.delete("http://localhost:3000/danhmuc/xoa", {
          headers,
          data: { MaDanhMuc: id }
        });
        if (response.data?.success) alert("Xóa danh mục thành công!");
      } else {
        // Khớp chuẩn Route Backend ĐVT: /xoa/:id
        const response = await axios.delete(`http://localhost:3000/donvitinh/xoa/${id}`, { headers });
        if (response.data?.success) alert("Xóa đơn vị tính thành công!");
      }
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || `Lỗi xảy ra khi thực hiện xóa ${itemTypeName}.`);
    }
  };

  // ==========================================
  // ĐỊNH NGHĨA CÁC CỘT HIỂN THỊ DỮ LIỆU BẢNG
  // ==========================================
  const categoryColumns = [
    { key: "MaDanhMuc", label: "Mã Số", render: (v) => <span className="font-mono font-bold text-gray-500">{v}</span> },
    { key: "TenDanhMuc", label: "Tên danh mục", render: (val, row) => row.TenDanhMuc || val },
    { key: "MoTa", label: "Mô tả phân loại", render: (val, row) => row.MoTa || <span className="text-gray-400 italic">Không có mô tả</span> },
    { key: "status", label: "Trạng thái", render: (_, row) => <StatusBadge status={row.IsDeleted ? 0 : 1} /> },
  ];

  const unitColumns = [
    { key: "MaDonVi", label: "Mã Hệ Thống", render: (v) => <span className="font-mono font-bold text-gray-500">{v}</span> },
    { key: "TenDonVi", label: "Đơn vị tính", render: (v) => <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{v}</span> },
    { key: "MoTa", label: "Ghi chú chi tiết", render: (val, row) => row.MoTa || <span className="text-gray-400 italic">Không có mô tả</span> },
  ];

  // Gán thêm cột hành động (Sửa/Xóa) nếu User có quyền hạn quản lý
  const activeColumns = activeTab === "CATEGORY" ? [...categoryColumns] : [...unitColumns];
  if (canManage) {
    activeColumns.push({
      key: "actions",
      label: "Hành động",
      render: (_, row) => {
        const id = activeTab === "CATEGORY" ? row.MaDanhMuc : row.MaDonVi;
        const name = activeTab === "CATEGORY" ? row.TenDanhMuc : row.TenDonVi;
        return (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => openEditModal(row)}
              className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
            >
              Sửa
            </button>
            <button 
              onClick={() => handleDeleteItem(id, name)}
              className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              Xóa
            </button>
          </div>
        );
      }
    });
  }

  return (
    <MainLayout>
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Cấu hình thuộc tính hàng hóa</h2>
          <p className="text-sm text-gray-400 mt-1">Quản lý hệ thống danh mục ngành hàng và các đơn vị tính định lượng sản phẩm</p>
        </div>
        
        {canManage && (
          <button 
            onClick={openCreateModal}
            className={`rounded-xl px-5 py-2.5 text-white text-sm font-bold shadow-md transition-all flex items-center gap-2 ${
              activeTab === "CATEGORY" ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            <FilePlus size={18}/>
            {activeTab === "CATEGORY" ? "Tạo danh mục mới" : "Tạo đơn vị tính mới"}
          </button>
        )}
      </div>

      {/* KPI STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div 
          onClick={() => setActiveTab("CATEGORY")}
          className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${activeTab === "CATEGORY" ? "border-blue-500 ring-2 ring-blue-500/10 shadow-md" : "border-gray-100 hover:border-blue-200"}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeTab === "CATEGORY" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}>
            <FolderTree size={20}/>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng danh mục</p>
            <h3 className="text-xl font-bold text-gray-800">{categories.length} <span className="text-xs font-normal text-gray-400 font-sans">Nhóm</span></h3>
          </div>
        </div>
        <div 
          onClick={() => setActiveTab("UNIT")}
          className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${activeTab === "UNIT" ? "border-emerald-500 ring-2 ring-emerald-500/10 shadow-md" : "border-gray-100 hover:border-emerald-200"}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeTab === "UNIT" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-600"}`}>
            <Scale size={20}/>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng đơn vị tính</p>
            <h3 className="text-xl font-bold text-emerald-600">{units.length} <span className="text-xs font-normal text-gray-400 font-sans">ĐVT</span></h3>
          </div>
        </div>
        <div 
          onClick={() => setSearchTerm("")}
          className="cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:border-indigo-200"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <CheckCircle2 size={20}/>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trạng thái hệ thống</p>
            <h3 className="text-xl font-bold text-indigo-600">Sẵn sàng</h3>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex space-x-2 mb-4 bg-gray-100 p-1.5 rounded-xl max-w-md">
        <button
          onClick={() => { setActiveTab("CATEGORY"); setError(""); }}
          className={`flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === "CATEGORY" 
              ? "bg-white text-blue-600 shadow-sm" 
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📁 Danh mục sản phẩm
        </button>
        <button
          onClick={() => { setActiveTab("UNIT"); setError(""); }}
          className={`flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === "UNIT" 
              ? "bg-white text-emerald-600 shadow-sm" 
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          ⚖️ Đơn vị tính
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
                placeholder={activeTab === "CATEGORY" ? "Tìm mã số, tên danh mục, mô tả..." : "Tìm mã hệ thống, tên đơn vị, ghi chú..."}
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

      {loading && <div className="flex items-center justify-center p-12 text-gray-400 animate-pulse">⏳ Đang đồng bộ dữ liệu với máy chủ...</div>}
      {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 mb-6 text-sm">⚠️ {error}</div>}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <DataTable 
            columns={activeColumns} 
            data={paginatedList} 
          />
          {filteredList.length === 0 && (
            <div className="p-12 text-center text-gray-400 text-sm italic">📭 Không tìm thấy kết quả phù hợp cho từ khóa này.</div>
          )}
        </div>
      )}

      {/* PAGINATION NAVIGATION */}
      {!loading && !error && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-500">
          <div>
            Hiển thị <span className="font-bold text-gray-800">{indexOfFirstItem + 1}</span> -{" "}
            <span className="font-bold text-gray-800">{Math.min(indexOfLastItem, totalItems)}</span> trên{" "}
            <span className="font-bold text-gray-800">{totalItems}</span> bản ghi
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

      {/* MODAL SỬ DỤNG CHUNG (TỰ ĐỘNG ĐỔI BANNER & NỘI DUNG THEO TAB ĐANG CHỌN) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {activeTab === "CATEGORY" 
                  ? (editingItem ? "Chỉnh sửa danh mục" : "Thêm danh mục mới")
                  : (editingItem ? "Chỉnh sửa đơn vị tính" : "Thêm đơn vị tính mới")}
              </h3>
              <button type="button" onClick={handleCloseModal} className="rounded-full border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50">
                Đóng
              </button>
            </div>

            {formError && <p className="mb-4 text-sm text-red-500 bg-red-50 p-2 rounded-lg font-medium">{formError}</p>}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              
              {activeTab === "CATEGORY" ? (
                <>
                  {/* CÁC TRƯỜNG DỮ LIỆU CỦA DANH MỤC */}
                  <label className="text-sm font-medium text-gray-700">
                    Tên danh mục <span className="text-red-500">*</span>
                    <input 
                      name="tenDanhMuc" 
                      value={categoryForm.tenDanhMuc} 
                      onChange={handleCategoryInputChange} 
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 bg-white text-sm" 
                      placeholder="Ví dụ: Thiết bị điện tử, Bánh kẹo..." 
                    />
                  </label>

                  <label className="text-sm font-medium text-gray-700">
                    Mô tả danh mục
                    <textarea 
                      name="moTa" 
                      value={categoryForm.moTa} 
                      onChange={handleCategoryInputChange} 
                      className="mt-1 min-h-[80px] w-full rounded-lg border border-gray-200 px-3 py-2 bg-white text-sm" 
                      placeholder="Nhập mô tả ngắn cho danh mục phân loại này" 
                    />
                  </label>
                </>
              ) : (
                <>
                  {/* CÁC TRƯỜNG DỮ LIỆU CỦA ĐƠN VỊ TÍNH */}
                  <label className="text-sm font-medium text-gray-700">
                    Tên đơn vị tính <span className="text-red-500">*</span>
                    <input 
                      name="tenDonVi" 
                      value={unitForm.tenDonVi} 
                      onChange={handleUnitInputChange} 
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 bg-white text-sm font-semibold text-emerald-800" 
                      placeholder="Ví dụ: Cái, Hộp, Chai, Thùng, Kg..." 
                    />
                  </label>

                  <label className="text-sm font-medium text-gray-700">
                    Mô tả đơn vị tính
                    <textarea 
                      name="moTaUnit" 
                      value={unitForm.moTaUnit} 
                      onChange={handleUnitInputChange} 
                      className="mt-1 min-h-[80px] w-full rounded-lg border border-gray-200 px-3 py-2 bg-white text-sm" 
                      placeholder="Nhập mô tả quy cách đóng gói (nếu có)" 
                    />
                  </label>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={handleCloseModal} className="rounded-lg border border-gray-200 px-4 py-2 text-sm bg-white">
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-70 shadow-sm transition-colors ${
                    activeTab === "CATEGORY" ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {isSubmitting ? "Đang lưu..." : editingItem ? "Cập nhật" : "Thêm mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}