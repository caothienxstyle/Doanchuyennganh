import { useState, useEffect, useCallback, useMemo } from "react";
import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable";
import { getCurrentRole, ROLES } from "../services/auth";
import { 
  getNhaCungCapList, 
  createNhaCungCap, 
  updateNhaCungCap, 
  deleteNhaCungCap 
} from "../services/nhaCungCapService";
import { Search, Building, UserCheck, Contact, Plus } from "lucide-react";

const EMPTY_FORM = {
  MaNCC: "",
  MaNCCCode: "",
  TenNCC: "",
  NguoiLienHe: "",
  SDT: "",
  Email: "",
  DiaChi: ""
};

export default function NhaCungCapPage() {
  const role = getCurrentRole();
  const canManage = role === ROLES.manager || role === ROLES.admin;

  const [nccList, setNccList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingNcc, setEditingNcc] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState("1");

  // Hàm load danh sách nhà cung cấp
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getNhaCungCapList();
      setNccList(data);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Không thể tải danh sách nhà cung cấp.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setEditingNcc(null);
    setModalOpen(false);
  };

  const openCreateModal = () => {
    setEditingNcc(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setActionMessage("");
    setModalOpen(true);
  };

  const openEditModal = (ncc) => {
    setEditingNcc(ncc);
    setForm({
      MaNCC: ncc.MaNCC || "",
      MaNCCCode: ncc.MaNCCCode || "",
      TenNCC: ncc.TenNCC || "",
      NguoiLienHe: ncc.NguoiLienHe || "",
      SDT: ncc.SDT || "",
      Email: ncc.Email || "",
      DiaChi: ncc.DiaChi || ""
    });
    setFormError("");
    setActionMessage("");
    setModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  // Xử lý Thêm / Sửa
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.TenNCC.trim()) {
      setFormError("Vui lòng nhập Tên nhà cung cấp.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError("");

      const payload = {
        MaNCCCode: form.MaNCCCode.trim() || null, // Backend tự sinh nếu trống
        TenNCC: form.TenNCC.trim(),
        NguoiLienHe: form.NguoiLienHe.trim() || null,
        SDT: form.SDT.trim() || null,
        Email: form.Email.trim() || null,
        DiaChi: form.DiaChi.trim() || null,
      };

      if (editingNcc) {
        // Gửi kèm MaNCC phục vụ mệnh đề WHERE update bên Backend
        payload.MaNCC = form.MaNCC; 
        await updateNhaCungCap(payload);
        setActionMessage("Cập nhật thông tin nhà cung cấp thành công.");
      } else {
        await createNhaCungCap(payload);
        setActionMessage("Thêm mới nhà cung cấp thành công!");
      }

      await loadData();
      resetForm();
    } catch (err) {
      setFormError(err?.response?.data?.message || err?.message || "Không thể lưu dữ liệu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý Xóa mềm
  const handleDelete = async (ncc) => {
    if (!window.confirm(`Bạn có chắc muốn xóa nhà cung cấp: "${ncc.TenNCC}"?`)) return;

    try {
      setLoading(true);
      await deleteNhaCungCap(ncc.MaNCC);
      setActionMessage("Xóa nhà cung cấp thành công.");
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Không thể xóa nhà cung cấp.");
    } finally {
      setLoading(false);
    }
  };

  // 🔍 LOGIC LỌC DỮ LIỆU THÔNG MINH
  const filteredNccList = useMemo(() => {
    return nccList.filter((ncc) => {
      const sTerm = searchTerm.toLowerCase().trim();
      if (!sTerm) return true;
      return (
        String(ncc.MaNCCCode || "").toLowerCase().includes(sTerm) ||
        String(ncc.TenNCC || "").toLowerCase().includes(sTerm) ||
        String(ncc.SDT || "").toLowerCase().includes(sTerm) ||
        String(ncc.NguoiLienHe || "").toLowerCase().includes(sTerm)
      );
    });
  }, [nccList, searchTerm]);

  // 🔢 TÍNH TOÁN PHÂN TRANG (Đồng bộ style ApprovePage)
  const totalItems = filteredNccList.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  
  const paginatedNcc = useMemo(() => {
    return filteredNccList.slice(indexOfFirstItem, indexOfLastItem);
  }, [filteredNccList, indexOfFirstItem, indexOfLastItem]);

  // Reset trang khi tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

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

  // Định nghĩa các cột hiển thị trong Table
  const tableColumns = [
    { key: "MaNCCCode", label: "Mã NCC", render: (val) => <span className="font-semibold text-blue-600">{val}</span> },
    { key: "TenNCC", label: "Tên nhà cung cấp", render: (val) => val },
    { key: "NguoiLienHe", label: "Người liên hệ", render: (val) => val || "---" },
    { key: "SDT", label: "Số điện thoại", render: (val) => val || "---" },
    { key: "Email", label: "Email", render: (val) => val || "---" },
    { key: "DiaChi", label: "Địa chỉ", render: (val) => <span className="text-xs max-w-xs block truncate">{val || "---"}</span> },
    {
      key: "actions",
      label: "Hành động",
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openEditModal(row)}
            className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          >
            Sửa
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => handleDelete(row)}
              className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
            >
              Xóa
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      {({ loading: mainLoading }) => (
        <>
          {/* Header Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Nhà Cung Cấp</h2>
              <p className="text-sm text-gray-400 mt-1">Quản lý thông tin đối tác cung ứng hàng hóa và chuỗi cung ứng</p>
            </div>
            {canManage && (
              <button 
                type="button" 
                onClick={openCreateModal} 
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-md flex items-center gap-2"
              >
                <Plus size={18} /> Thêm nhà cung cấp
              </button>
            )}
          </div>

          {/* KPI STATS CARDS (Đồng bộ layout trang Kho/Báo cáo) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-xs"><Building size={20}/></div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng đối tác</p>
                <h3 className="text-xl font-bold text-gray-800">{nccList.length} <span className="text-xs font-normal text-gray-400">Đơn vị</span></h3>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-xs"><Contact size={20}/></div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Người liên hệ</p>
                <h3 className="text-xl font-bold text-emerald-600">{nccList.filter(n => n.NguoiLienHe).length} <span className="text-xs font-normal text-gray-400">Đầu mối</span></h3>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-xs"><UserCheck size={20}/></div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trạng thái kết nối</p>
                <h3 className="text-xl font-bold text-indigo-600">Ổn định</h3>
              </div>
            </div>
          </div>

          {/* 🔍 SEARCH & FILTER BAR (Layout từ ApprovePage) */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3 relative">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tìm kiếm đối tác</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                  <input
                    type="text"
                    placeholder="Nhập mã NCC, tên nhà cung cấp, số điện thoại hoặc người liên hệ..."
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
                  <option value={10}>10 đối tác / trang</option>
                  <option value={20}>20 đối tác / trang</option>
                  <option value={50}>50 đối tác / trang</option>
                </select>
              </div>
            </div>
          </div>

          {actionMessage && <p className="mb-4 text-sm text-green-600 font-medium">✨ {actionMessage}</p>}
          {loading && <div className="flex items-center justify-center p-12 text-gray-400 animate-pulse font-medium">⏳ Đang tải danh sách nhà cung cấp...</div>}
          {error && <p className="text-sm text-red-500 font-semibold">⚠️ {error}</p>}

          {/* Data Table */}
          {!loading && (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <DataTable columns={tableColumns} data={paginatedNcc} />
                {filteredNccList.length === 0 && (
                  <div className="p-12 text-center text-gray-400 text-sm italic">📭 Không tìm thấy nhà cung cấp nào phù hợp.</div>
                )}
              </div>

              {/* 🔢 PAGINATION NAVIGATION (Layout từ ApprovePage) */}
              {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-500">
                  <div>
                    Hiển thị từ <span className="font-bold text-gray-800">{totalItems === 0 ? 0 : indexOfFirstItem + 1}</span> -{" "}
                    <span className="font-bold text-gray-800">{Math.min(indexOfLastItem, totalItems)}</span> trên{" "}
                    <span className="font-bold text-gray-800">{totalItems}</span> nhà cung cấp
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
            </>
          )}

          {/* Modal Add/Edit */}
          {modalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 max-h-screen overflow-y-auto">
              <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl my-8">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold">{editingNcc ? "Chỉnh sửa nhà cung cấp" : "Thêm nhà cung cấp mới"}</h3>
                  <button type="button" onClick={resetForm} className="rounded-full border border-gray-200 px-3 py-1 text-gray-500 hover:bg-gray-100">✕</button>
                </div>

                {formError && <p className="mb-4 text-sm text-red-500 font-semibold">⚠️ {formError}</p>}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mã đối tác (Không bắt buộc)</label>
                      <input
                        type="text"
                        name="MaNCCCode"
                        className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500 placeholder-gray-400"
                        placeholder="Để trống hệ thống tự sinh mã"
                        value={form.MaNCCCode}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tên nhà cung cấp (*)</label>
                      <input
                        type="text"
                        name="TenNCC"
                        className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500"
                        placeholder="Ví dụ: Công ty TNHH Hải Đăng"
                        value={form.TenNCC}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Người liên hệ trực tiếp</label>
                      <input
                        type="text"
                        name="NguoiLienHe"
                        className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500"
                        placeholder="Ví dụ: Nguyễn Văn A"
                        value={form.NguoiLienHe}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                      <input
                        type="text"
                        name="SDT"
                        className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500"
                        placeholder="Ví dụ: 0901234567"
                        value={form.SDT}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ Email</label>
                    <input
                      type="email"
                      name="Email"
                      className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500"
                      placeholder="partner@gmail.com"
                      value={form.Email}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ văn phòng / kho</label>
                    <textarea
                      name="DiaChi"
                      rows="2"
                      className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500"
                      placeholder="Số nhà, Tên đường, Quận/Huyện, Tỉnh/Thành phố..."
                      value={form.DiaChi}
                      onChange={handleInputChange}
                    ></textarea>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-6 border-t pt-4">
                    <button type="button" onClick={resetForm} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSubmitting ? "Đang xử lý..." : "Lưu nhà cung cấp"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </MainLayout>
  );
}