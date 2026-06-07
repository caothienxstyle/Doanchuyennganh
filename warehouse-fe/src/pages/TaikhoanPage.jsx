import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable";

export default function TaikhoanPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageInput, setPageInput] = useState("1");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const [formData, setFormData] = useState({
    TenDangNhap: "",
    MatKhau: "",
    MaNhanVien: "",
    MaVaiTro: "",
    TrangThai: 1,
  });

  const [employeeList, setEmployeeList] = useState([]);
  const [roleList, setRoleList] = useState([]);

  const getToken = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";

  const loadDanhSachTaiKhoan = async () => {
    try {
      setLoading(true);
      setError("");
      const queryParams = new URLSearchParams({
        trang: currentPage,
        soLuong: itemsPerPage,
        tuKhoa: searchTerm,
      });
      if (statusFilter !== "") queryParams.append("trangThai", statusFilter);

      const response = await fetch(`http://localhost:3000/taikhoan/danhsach?${queryParams.toString()}`, {
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` }
      });
      const res = await response.json();
      if (res.success) {
        setAccounts(res.data || []);
        setTotalItems(res.phanTrang?.tongSo || 0);
        setTotalPages(res.phanTrang?.tongTrang || 1);
      } else {
        throw new Error(res.message || "Không thể tải danh sách tài khoản.");
      }
    } catch (err) {
      setError(err.message || "Lỗi kết nối đến máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeList = async () => {
    try {
      const res = await fetch("http://localhost:3000/nhanvien/danhsach", {
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (data.success) setEmployeeList(data.data || []);
    } catch (err) {
      console.error("Lỗi tải danh sách nhân viên:", err);
    }
  };

  const loadRoleList = async () => {
    try {
      const res = await fetch("http://localhost:3000/phanquyen/roles/danhsach", {
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (data.success) setRoleList(data.data || []);
    } catch (err) {
      console.error("Lỗi tải danh sách vai trò:", err);
    }
  };

  // FIX 1: Bỏ useEffect bị duplicate (gọi loadDanhSachTaiKhoan 2 lần, setCurrentPage(1) 2 lần)
  // 🌟 BỔ SUNG: Thêm searchTerm vào đây để bảng cập nhật ngay khi gõ tìm kiếm
  useEffect(() => { loadDanhSachTaiKhoan(); }, [currentPage, itemsPerPage, statusFilter, searchTerm]);
  useEffect(() => { loadEmployeeList(); loadRoleList(); }, []);
  useEffect(() => { setPageInput(String(currentPage)); }, [currentPage]);

  const handlePageInputBlurOrEnter = (e) => {
    if (e.key && e.key !== "Enter") return;
    let targetPage = parseInt(pageInput, 10);
    if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
    if (targetPage > totalPages) targetPage = totalPages;
    setCurrentPage(targetPage);
    setPageInput(String(targetPage));
  };

  const handleOpenCreate = () => {
    setIsEditMode(false);
    setSelectedAccount(null);
    setFormData({ TenDangNhap: "", MatKhau: "", MaNhanVien: "", MaVaiTro: "", TrangThai: 1 });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (account) => {
    setIsEditMode(true);
    setSelectedAccount(account);
    setFormData({
      TenDangNhap: account.TenDangNhap || "",
      MatKhau: "",
      MaNhanVien: account.MaNhanVien || "",
      MaVaiTro: account.MaVaiTro || "",
      TrangThai: account.TrangThai ?? 1,
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.TenDangNhap.trim()) return alert("Tên đăng nhập không được để trống!");
    if (!isEditMode && !formData.MatKhau.trim()) return alert("Mật khẩu không được để trống khi tạo mới!");
    if (!formData.MaNhanVien) return alert("Vui lòng chọn nhân viên!");
    if (!formData.MaVaiTro) return alert("Vui lòng chọn vai trò!");

    try {
      // FIX 2: Khi sửa chỉ gửi MaVaiTro (đúng với BE — PUT /capnhat/:id chỉ nhận MaVaiTro)
      const url = isEditMode
        ? `http://localhost:3000/taikhoan/capnhat/${selectedAccount.MaTaiKhoan}`
        : "http://localhost:3000/taikhoan/taomoi";

      const method = isEditMode ? "PUT" : "POST";

      const payload = isEditMode
        ? { MaVaiTro: Number(formData.MaVaiTro) }
        : {
            TenDangNhap: formData.TenDangNhap,
            MatKhau: formData.MatKhau,
            MaNhanVien: Number(formData.MaNhanVien),
            MaVaiTro: Number(formData.MaVaiTro),
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` },
        body: JSON.stringify(payload)
      });
      const res = await response.json();
      if (res.success) {
        alert(res.message || "Thao tác thành công!");
        setIsModalOpen(false);
        loadDanhSachTaiKhoan();
      } else {
        alert("Lỗi: " + res.message);
      }
    } catch (err) {
      alert("Lỗi kết nối: " + err.message);
    }
  };

  const handleChangeRole = async (account) => {
    const newRole = prompt(`Nhập ID vai trò mới cho "${account.TenDangNhap}" (hiện tại: ${account.MaVaiTro}):`);
    if (!newRole || isNaN(Number(newRole))) return;
    if (!window.confirm(`Đổi vai trò tài khoản "${account.TenDangNhap}" sang ID: ${newRole}?`)) return;
    try {
      const res = await fetch(`http://localhost:3000/taikhoan/capnhat/${account.MaTaiKhoan}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` },
        body: JSON.stringify({ MaVaiTro: Number(newRole) })
      });
      const data = await res.json();
      if (data.success) { alert(data.message); loadDanhSachTaiKhoan(); }
      else alert("Lỗi: " + data.message);
    } catch (err) { alert("Lỗi kết nối: " + err.message); }
  };

  const handleResetPassword = async (account) => {
    const newPassword = prompt(`Nhập mật khẩu mới cho tài khoản "${account.TenDangNhap}":`);
    if (!newPassword?.trim()) return;
    if (!window.confirm(`Đặt lại mật khẩu cho "${account.TenDangNhap}"?`)) return;
    try {
      const res = await fetch(`http://localhost:3000/taikhoan/doiMatKhau/${account.MaTaiKhoan}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` },
        body: JSON.stringify({ MatKhauMoi: newPassword })
      });
      const data = await res.json();
      if (data.success) alert(data.message);
      else alert("Lỗi: " + data.message);
    } catch (err) { alert("Lỗi kết nối: " + err.message); }
  };

  const handleToggleStatus = async (account) => {
    const newStatus = Number(account.TrangThai) === 1 ? 0 : 1;
    const actionText = newStatus === 0 ? "khóa" : "mở khóa";
    if (!window.confirm(`Bạn có chắc muốn ${actionText} tài khoản "${account.TenDangNhap}"?`)) return;
    try {
      const res = await fetch(`http://localhost:3000/taikhoan/trangthai/${account.MaTaiKhoan}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` },
        body: JSON.stringify({ TrangThai: newStatus })
      });
      const data = await res.json();
      if (data.success) { alert(data.message); loadDanhSachTaiKhoan(); }
      else alert("Lỗi: " + data.message);
    } catch (err) { alert("Lỗi kết nối: " + err.message); }
  };

  const handleDeleteAccount = async (account) => {
    if (!window.confirm(`Xóa tài khoản "${account.TenDangNhap}"? Thao tác không thể hoàn tác!`)) return;
    try {
      const res = await fetch(`http://localhost:3000/taikhoan/xoa/${account.MaTaiKhoan}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (data.success) { alert(data.message); loadDanhSachTaiKhoan(); }
      else alert("Lỗi: " + data.message);
    } catch (err) { alert("Lỗi kết nối: " + err.message); }
  };

  return (
    <MainLayout>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Quản lý Tài khoản hệ thống</h2>
          <p className="text-sm text-gray-400 mt-1">Phân quyền, kiểm tra trạng thái hoạt động (Chỉ dành cho Admin)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleOpenCreate} className="bg-green-600 hover:bg-green-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors">
            + Tạo tài khoản mới
          </button>
          <button onClick={loadDanhSachTaiKhoan} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors">
            Làm mới
          </button>
        </div>
      </div>

      {/* BỘ LỌC */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Tìm kiếm</label>
            <input
              type="text"
              placeholder="Tên đăng nhập, tên nhân viên..."
              className="w-full pl-3 pr-8 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-500 text-gray-700"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button 
                onClick={() => { setSearchTerm(""); setCurrentPage(1); }} 
                className="absolute right-2.5 top-7 text-gray-400 hover:text-gray-600 text-xs"
              >
                &times;
              </button>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Trạng thái</label>
            <select className="w-full border border-gray-200 rounded-lg p-1.5 text-xs bg-white text-gray-700" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">— Tất cả —</option>
              <option value="1">Đang hoạt động</option>
              <option value="0">Đã bị khóa</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Số dòng</label>
            <select className="w-full border border-gray-200 rounded-lg p-1.5 text-xs bg-white text-gray-700" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              <option value={10}>10 dòng / trang</option>
              <option value={20}>20 dòng / trang</option>
              <option value={50}>50 dòng / trang</option>
            </select>
          </div>
        </div>
        {(searchTerm || statusFilter) && (
          <div className="flex justify-end pt-1 border-t border-dashed">
            <button onClick={() => { setSearchTerm(""); setStatusFilter(""); setCurrentPage(1); }} className="text-xs text-red-500 hover:underline font-semibold">
              Xóa tất cả bộ lọc
            </button>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500 animate-pulse my-4">Đang tải danh sách tài khoản...</p>}
      {error && <p className="text-sm text-red-500 mb-4 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}

      {/* BẢNG DỮ LIỆU */}
      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <DataTable
            columns={[
              { key: "MaTaiKhoan", label: "Mã", render: (v) => <span className="font-mono text-gray-400 text-xs">#{v}</span> },
              { key: "TenDangNhap", label: "Tên đăng nhập", render: (v) => <span className="font-semibold text-gray-700 text-xs font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{v}</span> },
              { key: "TenNhanVien", label: "Nhân viên", render: (v) => <span className="font-medium text-gray-800 text-xs">{v || "Chưa gán"}</span> },
              {
                key: "TenVaiTro", label: "Vai trò",
                render: (v) => {
                  const isAdmin = v?.toLowerCase().includes("admin");
                  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${isAdmin ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>{v || "User"}</span>;
                }
              },
              {
                key: "SoLanDangNhapSai", label: "Đăng nhập sai",
                render: (v) => <span className={`text-xs font-mono font-bold ${Number(v) > 3 ? "text-red-600" : "text-gray-500"}`}>{v} lần</span>
              },
              {
                key: "TrangThai", label: "Trạng thái",
                render: (v) => {
                  const isActive = Number(v) === 1;
                  return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                      <span className={`w-1 h-1 rounded-full ${isActive ? "bg-green-500" : "bg-red-500"}`}></span>
                      {isActive ? "Hoạt động" : "Bị khóa"}
                    </span>
                  );
                }
              },
              {
                key: "actions", label: "Tác vụ",
                render: (_, row) => (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => handleOpenEdit(row)} className="text-blue-600 text-xs font-semibold bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded">Sửa vai trò</button>
                    <button onClick={() => handleResetPassword(row)} className="text-orange-600 text-xs font-semibold bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded">Đặt lại MK</button>
                    <button onClick={() => handleToggleStatus(row)} className={`text-xs font-semibold px-2 py-1 rounded ${Number(row.TrangThai) === 1 ? "text-red-600 bg-red-50 hover:bg-red-100" : "text-green-600 bg-green-50 hover:bg-green-100"}`}>
                      {Number(row.TrangThai) === 1 ? "Khóa" : "Mở khóa"}
                    </button>
                    <button onClick={() => handleDeleteAccount(row)} className="text-gray-600 text-xs font-semibold bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded">Xóa</button>
                  </div>
                )
              }
            ]}
            data={accounts}
          />
          {accounts.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-400 bg-gray-50/30 text-sm">
              Không tìm thấy tài khoản nào khớp với bộ lọc.
            </div>
          )}
        </div>
      )}

      {/* PHÂN TRANG */}
      {!loading && !error && accounts.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-sm text-gray-600">
          <div>Trang <span className="font-semibold text-gray-800">{currentPage}</span> / <span className="font-semibold text-gray-800">{totalPages}</span> — Tổng <span className="font-semibold text-gray-800">{totalItems}</span> kết quả</div>
          <div className="flex items-center space-x-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 text-xs hover:bg-gray-50">&laquo;</button>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 text-xs hover:bg-gray-50">&lsaquo;</button>
            <div className="flex items-center space-x-1.5 px-2 py-0.5 border border-gray-200 rounded bg-gray-50">
              <span className="text-xs text-gray-500">Trang</span>
              <input type="number" min="1" max={totalPages} className="w-12 text-center border rounded bg-white font-bold text-blue-600 focus:outline-none p-0.5 text-sm" value={pageInput} onChange={(e) => setPageInput(e.target.value)} onBlur={handlePageInputBlurOrEnter} onKeyDown={handlePageInputBlurOrEnter} />
            </div>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 text-xs hover:bg-gray-50">&rsaquo;</button>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 text-xs hover:bg-gray-50">&raquo;</button>
          </div>
        </div>
      )}

      {/* FIX 3: MODAL TẠO / SỬA — bị thiếu hoàn toàn trong code gốc */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800">{isEditMode ? "Sửa vai trò tài khoản" : "Tạo tài khoản mới"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {/* Tên đăng nhập — chỉ hiện khi tạo mới */}
              {!isEditMode && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tên đăng nhập <span className="text-red-500">*</span></label>
                  <input type="text" required className="w-full border rounded-lg p-2 text-sm" value={formData.TenDangNhap} onChange={(e) => setFormData({ ...formData, TenDangNhap: e.target.value })} placeholder="VD: nv001" />
                </div>
              )}

              {/* Mật khẩu — chỉ hiện khi tạo mới */}
              {!isEditMode && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mật khẩu <span className="text-red-500">*</span></label>
                  <input type="password" required className="w-full border rounded-lg p-2 text-sm" value={formData.MatKhau} onChange={(e) => setFormData({ ...formData, MatKhau: e.target.value })} placeholder="Tối thiểu 6 ký tự" />
                </div>
              )}

              {/* Chọn nhân viên — chỉ hiện khi tạo mới */}
              {!isEditMode && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nhân viên <span className="text-red-500">*</span></label>
                  <select required className="w-full border rounded-lg p-2 text-sm bg-white" value={formData.MaNhanVien} onChange={(e) => setFormData({ ...formData, MaNhanVien: e.target.value })}>
                    <option value="">-- Chọn nhân viên --</option>
                    {employeeList.map((nv) => (
                      <option key={nv.MaNhanVien} value={nv.MaNhanVien}>{nv.TenNhanVien} — {nv.Email || "Chưa có email"}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Chọn vai trò — hiện cả khi tạo mới và sửa */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vai trò <span className="text-red-500">*</span></label>
                <select required className="w-full border rounded-lg p-2 text-sm bg-white" value={formData.MaVaiTro} onChange={(e) => setFormData({ ...formData, MaVaiTro: e.target.value })}>
                  <option value="">-- Chọn vai trò --</option>
                  {roleList.map((vt) => (
                    <option key={vt.MaVaiTro} value={vt.MaVaiTro}>{vt.TenVaiTro}</option>
                  ))}
                </select>
              </div>

              {/* FIX 4: Thêm thông tin tài khoản đang sửa để người dùng biết */}
              {isEditMode && selectedAccount && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                  Đang sửa tài khoản: <span className="font-bold font-mono">{selectedAccount.TenDangNhap}</span>
                  <br />Vai trò hiện tại: <span className="font-bold">{selectedAccount.TenVaiTro || `ID: ${selectedAccount.MaVaiTro}`}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50">Hủy</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm">
                  {isEditMode ? "Lưu thay đổi" : "Tạo tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}