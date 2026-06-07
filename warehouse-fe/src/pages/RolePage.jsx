import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable";

export default function RolePage() {
  // 🧭 Base URL theo chuẩn tài liệu mới của Backend
  const BASE_URL = "http://localhost:3000/phanquyen";

  // 🗂️ Quản lý chuyển đổi giữa 2 Tab chính
  const [activeTab, setActiveTab] = useState("vaitro"); // "vaitro" | "quyenhan"

  // 📦 State lưu trữ dữ liệu từ API Backend
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]); // Chứa danh sách quyền lấy từ API /permissions
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 📝 State quản lý Form Modal 1: Thêm/Sửa VAI TRÒ
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState(null); // null = Thêm mới, có ID = Sửa
  const [tenVaiTro, setTenVaiTro] = useState("");
  const [moTaVaiTro, setMoTaVaiTro] = useState("");
  const [danhSachMaQuyen, setDanhSachMaQuyen] = useState([]); // Mảng [1, 2, 3...] chứa ID MaQuyen được tick

  // 📝 State quản lý Form Modal 2: Tạo mới QUYỀN HẠN
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [tenQuyen, setTenQuyen] = useState("");
  const [moTaQuyen, setMoTaQuyen] = useState("");

  const getToken = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";

  // 1. GET /permissions - Tải danh sách tất cả các quyền hạn có trong hệ thống
  const loadDanhSachQuyenHan = async () => {
    try {
      const response = await fetch(`${BASE_URL}/permissions`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        }
      });
      const res = await response.json();
      if (res.success) {
        setPermissions(res.data || []);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách quyền hạn:", err);
    }
  };

  // 2. GET /roles/danhsach - Tải danh sách Vai trò kèm quyền hạn chi tiết
  const loadDanhSachVaiTro = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${BASE_URL}/roles/danhsach`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        }
      });
      const res = await response.json();
      if (res.success) {
        setRoles(res.data || []);
      } else {
        throw new Error(res.message || "Không thể lấy danh sách vai trò từ máy chủ.");
      }
    } catch (err) {
      setError(err.message || "Lỗi kết nối cơ sở dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  // Tải song song dữ liệu cả 2 module khi vào trang
  useEffect(() => {
    loadDanhSachVaiTro();
    loadDanhSachQuyenHan();
  }, []);

  // 🛠️ Xử lý tick/bỏ chọn checkbox quyền hạn (Quản lý mảng số nguyên)
  const handleCheckboxChange = (maQuyen) => {
    setDanhSachMaQuyen((prev) =>
      prev.includes(maQuyen) ? prev.filter((id) => id !== maQuyen) : [...prev, maQuyen]
    );
  };

  // ➕ Bấm nút Thêm mới Vai trò
  const handleCreateRoleClick = () => {
    setEditingRoleId(null);
    setTenVaiTro("");
    setMoTaVaiTro("");
    setDanhSachMaQuyen([]); // Xóa trắng mảng quyền để tick từ đầu
    setIsRoleModalOpen(true);
  };

  // ✏️ Bấm nút Sửa Vai trò (Tự động kích hoạt trạng thái checked dựa trên mảng QuyenHan của BE)
  const handleEditRoleClick = (role) => {
    setEditingRoleId(role.MaVaiTro);
    setTenVaiTro(role.TenVaiTro);
    setMoTaVaiTro(role.MoTa || "");
    
    // Auto tick: Chuyển mảng Object quyền từ API thành mảng chứa ID nguyên bản [1, 2, 5]
    const activeIds = (role.QuyenHan || []).map((p) => p.MaQuyen);
    setDanhSachMaQuyen(activeIds);
    setIsRoleModalOpen(true);
  };

  // 💾 LƯU FORM VAI TRÒ (ĐÃ SỬA LỖI ĐÍNH KÈM MaVaiTro VÀO TRONG BODY KHI UPDATE)
  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!tenVaiTro.trim()) return alert("Vui lòng nhập tên vai trò!");

    // Cấu trúc Body đóng gói cơ bản
    const payload = {
      TenVaiTro: tenVaiTro,
      MoTa: moTaVaiTro,
      DanhSachMaQuyen: danhSachMaQuyen // Mảng số nguyên dạng [1, 5, 6]
    };

    // 🔥 SỬA LỖI QUAN TRỌNG: Nếu là hành động Cập nhật (Sửa), BE yêu cầu truyền cả MaVaiTro nằm TRONG body JSON gán với ID hiện tại
    if (editingRoleId) {
      payload.MaVaiTro = editingRoleId;
    }

    try {
      const url = editingRoleId 
        ? `${BASE_URL}/roles/capnhat/${editingRoleId}` 
        : `${BASE_URL}/roles/taomoi`;

      const response = await fetch(url, {
        method: editingRoleId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        },
        body: JSON.stringify(payload)
      });

      const res = await response.json();
      if (res.success) {
        alert(res.message || "Lưu cấu hình vai trò thành công!");
        setIsRoleModalOpen(false);
        loadDanhSachVaiTro();
      } else {
        alert(res.message || "Xảy ra lỗi khi lưu thông tin.");
      }
    } catch (err) {
      alert("Lỗi kết nối API: " + err.message);
    }
  };

  // 🗑️ XÓA VAI TRÒ (DELETE /roles/xoa/:id)
  const handleDeleteRole = async (maVaiTro, tenVaiTro) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vai trò "${tenVaiTro}" ra khỏi hệ thống? Việc này không thể hoàn tác.`)) {
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/roles/xoa/${maVaiTro}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        }
      });
      const res = await response.json();
      if (res.success) {
        alert(res.message || "Xóa vai trò thành công!");
        loadDanhSachVaiTro(); // Tải lại dữ liệu bảng
      } else {
        alert(res.message || "Không thể xóa vai trò này.");
      }
    } catch (err) {
      alert("Lỗi khi kết nối API xóa: " + err.message);
    }
  };

  // 💾 LƯU FORM QUYỀN HẠN MỚI (POST /permissions/taomoi)
  const handleSavePermission = async (e) => {
    e.preventDefault();
    if (!tenQuyen.trim()) return alert("Vui lòng nhập Từ khóa lập trình quyền!");

    const payload = {
      TenQuyen: tenQuyen.trim().toUpperCase(), // Tự động viết hoa như XEM_BAO_CAO
      MoTa: moTaQuyen
    };

    try {
      const response = await fetch(`${BASE_URL}/permissions/taomoi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        },
        body: JSON.stringify(payload)
      });
      const res = await response.json();
      if (res.success) {
        alert(res.message || "Tạo mới quyền hạn thành công!");
        setIsPermModalOpen(false);
        setTenQuyen("");
        setMoTaQuyen("");
        loadDanhSachQuyenHan(); // Làm mới dữ liệu bảng tra cứu
      } else {
        alert(res.message || "Thao tác thất bại.");
      }
    } catch (err) {
      alert("Lỗi kết nối API quyền: " + err.message);
    }
  };

  return (
    <MainLayout>
      {/* Khối tiêu đề đầu trang */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Cấu hình Quyền & Vai trò</h2>
        <p className="text-sm text-gray-400 mt-1">Quản trị cấp cao: Thiết lập danh sách chức vụ, phân quyền dữ liệu và đồng bộ hệ thống</p>
      </div>

      {/* 🧭 THANH ĐIỀU HƯỚNG TABS (2 TABS) */}
      <div className="flex border-b border-gray-200 mb-6 bg-white p-2 rounded-xl shadow-xs gap-2">
        <button
          onClick={() => setActiveTab("vaitro")}
          className={`flex-1 sm:flex-none px-5 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === "vaitro"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
          }`}
        >
          💼 1. Vai trò & Phân quyền
        </button>
        <button
          onClick={() => setActiveTab("quyenhan")}
          className={`flex-1 sm:flex-none px-5 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === "quyenhan"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
          }`}
        >
          🔑 2. Danh sách Quyền hạn hệ thống
        </button>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 p-3 rounded-lg mb-4">{error}</p>}

      {/* ======================= TAB 1: VAI TRÒ & PHÂN QUYỀN ======================= */}
      {activeTab === "vaitro" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={handleCreateRoleClick}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              ➕ Tạo mới Vai trò mới
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 animate-pulse">Đang nạp cấu trúc sơ đồ vai trò hệ thống...</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <DataTable
                columns={[
                  {
                    key: "MaVaiTro",
                    label: "Mã ID",
                    render: (v) => <span className="font-mono font-bold text-gray-400 text-xs">#{v}</span>
                  },
                  {
                    key: "TenVaiTro",
                    label: "Tên chức vụ / Vai trò",
                    render: (v) => <span className="font-bold text-gray-800 text-xs">{v}</span>
                  },
                  {
                    key: "MoTa",
                    label: "Mô tả trách nhiệm công việc",
                    render: (v) => <span className="text-gray-500 text-xs">{v || "—"}</span>
                  },
                  {
                    key: "QuyenHan",
                    label: "Các Quyền Được Cấp Phép",
                    render: (v) => (
                      <div className="flex flex-wrap gap-1 max-w-xl">
                        {v && v.length > 0 ? (
                          v.map((p) => (
                            <span 
                              key={p.MaQuyen} 
                              className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold px-1.5 py-0.5 rounded-sm"
                              title={p.MoTa}
                            >
                              {p.TenQuyen}
                            </span>
                          ))
                        ) : (
                          <span className="text-red-400 text-[10px] italic font-semibold">Bị khóa (Chưa cấu hình quyền)</span>
                        )}
                      </div>
                    )
                  },
                  {
                    key: "actions",
                    label: "Hành động",
                    render: (_, row) => (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditRoleClick(row)}
                          className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                        >
                          ✏️ Sửa quyền
                        </button>
                        <button
                          onClick={() => handleDeleteRole(row.MaVaiTro, row.TenVaiTro)}
                          className="text-red-600 hover:text-red-800 font-bold text-xs bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                        >
                          🗑️ Xóa
                        </button>
                      </div>
                    )
                  }
                ]}
                data={roles}
              />
            </div>
          )}
        </div>
      )}

      {/* ======================= TAB 2: DANH SÁCH QUYỀN HẠN TỪ API ======================= */}
      {activeTab === "quyenhan" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsPermModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              🔑 Tạo mã Quyền hạn mới
            </button>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="mb-4">
              <h3 className="font-bold text-gray-800 text-sm">Bảng tra cứu danh mục Quyền hạn (Permissions)</h3>
              <p className="text-xs text-gray-400 mt-0.5">Dữ liệu đồng bộ trực tiếp từ API GET /permissions để lập trình viên đối chiếu</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-bold uppercase border-b text-[10px]">
                    <th className="p-3">ID (MaQuyen)</th>
                    <th className="p-3">Từ khóa hệ thống (TenQuyen)</th>
                    <th className="p-3">Mô tả chi tiết tính năng</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-600">
                  {permissions.map((p) => (
                    <tr key={p.MaQuyen} className="hover:bg-gray-50/50">
                      <td className="p-3 font-mono font-bold text-indigo-600">#{p.MaQuyen}</td>
                      <td className="p-3">
                        <span className="bg-slate-100 text-slate-800 font-mono text-[11px] px-2 py-0.5 rounded border border-slate-200">
                          {p.TenQuyen}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500 font-medium">{p.MoTa}</td>
                    </tr>
                  ))}
                  {permissions.length === 0 && (
                    <tr>
                      <td colSpan="3" className="p-4 text-center text-gray-400 italic">Không tìm thấy quyền hạn nào trong database.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL 1: FORM THÊM / SỬA VAI TRÒ ======================= */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form 
            onSubmit={handleSaveRole}
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all border border-gray-100 flex flex-col max-h-[90vh]"
          >
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm">
                {editingRoleId ? `🛠️ Cấu hình và Đồng bộ quyền: ${tenVaiTro}` : "➕ Thiết lập chức vụ & Vai trò mới"}
              </h3>
              <button type="button" onClick={() => setIsRoleModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Tên Vai trò <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nhân viên kiểm kê, Quản lý kho cấp cao..."
                  className="w-full p-2 border border-gray-200 rounded-lg text-xs bg-white text-gray-800 font-semibold focus:outline-none focus:border-blue-500"
                  value={tenVaiTro}
                  onChange={(e) => setTenVaiTro(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Mô tả công việc</label>
                <textarea
                  placeholder="Ghi chú chi tiết trách nhiệm, quyền hạn..."
                  className="w-full p-2 border border-gray-200 rounded-lg text-xs bg-white text-gray-800 focus:outline-none focus:border-blue-500 h-16 resize-none"
                  value={moTaVaiTro}
                  onChange={(e) => setMoTaVaiTro(e.target.value)}
                />
              </div>

              {/* KHỐI CHECKBOX PHÂN QUYỀN ĐỘNG THEO KẾT QUẢ API */}
              <div className="border-t pt-3">
                <label className="block text-[11px] font-bold text-blue-600 uppercase mb-2 tracking-wider">
                  Tích chọn quyền hạn đi kèm (DanhSachMaQuyen)
                </label>
                
                {permissions.length === 0 ? (
                  <p className="text-gray-400 italic">Hệ thống chưa nạp dữ liệu quyền hạn.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border max-h-60 overflow-y-auto">
                    {permissions.map((p) => {
                      const isChecked = danhSachMaQuyen.includes(p.MaQuyen);
                      return (
                        <label 
                          key={p.MaQuyen}
                          className={`flex items-start gap-2.5 p-2 rounded-md border cursor-pointer transition-all ${
                            isChecked ? "bg-blue-50 border-blue-200" : "bg-white border-gray-100 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 w-3.5 h-3.5 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                            checked={isChecked}
                            onChange={() => handleCheckboxChange(p.MaQuyen)}
                          />
                          <div>
                            <p className="font-mono font-bold text-gray-800 text-[11px]">{p.TenQuyen}</p>
                            <p className="text-[10px] text-gray-400 font-medium mt-0.5">{p.MoTa}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                
                <p className="text-[11px] text-right text-gray-400 mt-2">
                  Đã chọn: <span className="font-bold text-blue-600">{danhSachMaQuyen.length}</span> quyền hạn.
                </p>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t flex justify-end gap-2">
              <button type="button" onClick={() => setIsRoleModalOpen(false)} className="px-4 py-2 font-semibold text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300">Hủy</button>
              <button type="submit" className="px-5 py-2 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md">💾 Lưu cấu hình</button>
            </div>
          </form>
        </div>
      )}

      {/* ======================= MODAL 2: FORM THÊM MỚI QUYỀN HẠN ======================= */}
      {isPermModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form 
            onSubmit={handleSavePermission}
            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
          >
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm">🔑 Tạo mã đặc quyền mới (Hệ thống)</h3>
              <button type="button" onClick={() => setIsPermModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Từ khóa quyền (Viết liền, in hoa)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: XEM_BAO_CAO, QUAN_LY_KHO..."
                  className="w-full p-2 border border-gray-200 rounded-lg text-xs bg-white text-gray-800 font-mono font-bold focus:outline-none focus:border-indigo-500"
                  value={tenQuyen}
                  onChange={(e) => setTenQuyen(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Diễn giải / Mô tả quyền hạn</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Quyền truy cập và xem báo cáo..."
                  className="w-full p-2 border border-gray-200 rounded-lg text-xs bg-white text-gray-800 focus:outline-none focus:border-indigo-500"
                  value={moTaQuyen}
                  onChange={(e) => setMoTaQuyen(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t flex justify-end gap-2 text-xs">
              <button type="button" onClick={() => setIsPermModalOpen(false)} className="px-4 py-2 font-semibold text-gray-600 bg-gray-200 rounded-lg">Đóng</button>
              <button type="submit" className="px-5 py-2 font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">🚀 Khởi tạo quyền</button>
            </div>
          </form>
        </div>
      )}
    </MainLayout>
  );
}