import { useEffect, useState, useMemo } from "react";
import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable";
import { Search, Plus, UserPlus, Loader2 } from "lucide-react";
import { getCurrentRole, ROLES } from "../services/auth";
import axios from "axios";

const SERVER_URL = "http://localhost:3000";

export default function NhanvienPage() {
  const [employeeList, setEmployeeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // 🔢 Quản lý phân trang & hiển thị
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState("1");

  // Trạng thái điều khiển Modal Form (Thêm mới / Sửa)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [zoomedImage, setZoomedImage] = useState(null);

  // 🛡️ Sử dụng logic phân quyền chuẩn để tránh lỗi mất quyền truy cập
  const role = getCurrentRole();
  const isAdmin = role === ROLES.admin || String(role) === "1" || role === "Admin";
  const isManager = role === ROLES.manager || String(role) === "2" || role === "Quản lý kho";
  const canManage = isAdmin || isManager;

  // Form State tuân thủ chính xác Schema cấu trúc dữ liệu nhận của BE
  const [formData, setFormData] = useState({
    TenNhanVien: "",
    NgaySinh: "",
    GioiTinh: true, 
    SDT: "",
    Email: "",
    CCCD: "",
    DiaChi: "",
    AnhDaiDien: "",
    TrangThai: true 
  });

  const getToken = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";

  // 1. TẢI DANH SÁCH NHÂN VIÊN TỪ BACKEND
  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError("");

      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`
      };

      // 🌟 LUÔN LUÔN gọi API lấy danh sách nhân sự
      const fetchPromises = [
        fetch("http://localhost:3000/nhanvien/danhsach", { headers }),
      ];

      // 🌟 KIỂM TRA QUYỀN: CHỈ CÓ ADMIN mới được phép gọi API Tài khoản để quét chéo
      // (Biến isAdmin đã được bạn khai báo ở trên: const isAdmin = role === ROLES.admin...)
      if (isAdmin) {
        fetchPromises.push(fetch("http://localhost:3000/taikhoan/danhsach?soLuong=5000", { headers }));
      }

      const results = await Promise.allSettled(fetchPromises);

      // Trích xuất kết quả nạp nhân viên (Bắt buộc phải thành công)
      const empResult = results[0];
      if (empResult.status === "rejected" || !empResult.value.ok) {
        throw new Error("Không thể tải danh sách nhân viên từ hệ thống.");
      }
      const empData = await empResult.value.json();

      let adminEmployeeIds = new Set();

      // Nếu là Admin và có kết quả API tài khoản (nằm ở vị trí 1)
      if (isAdmin && results.length > 1) {
        const accResult = results[1];
        if (accResult.status === "fulfilled" && accResult.value.ok) {
          const accData = await accResult.value.json();
          if (accData.success) {
            // Quét tìm ID của các tài khoản Admin
            (accData.data || []).forEach(acc => {
              const roleId = String(acc.MaVaiTro || acc.roleId || acc.VaiTro?.MaVaiTro || "");
              const roleName = String(acc.TenVaiTro || acc.VaiTro?.TenVaiTro || "").toLowerCase();
              
              if (roleId === "1" || roleName.includes("admin")) {
                const empId = acc.MaNhanVien || acc.NhanVien?.MaNhanVien;
                // 🌟 FIX 1: ÉP KIỂU STRING KHI THÊM VÀO SET ĐỂ TRÁNH LỆCH KIỂU DỮ LIỆU
                if (empId) adminEmployeeIds.add(String(empId));
              }
            });
          }
        }
      }

      // 🌟 DEBUG: Xem dữ liệu thực tế trả về để kiểm tra logic lọc
      console.log("Dữ liệu 1 nhân viên mẫu từ BE:", empData.data?.[0]);
      console.log("Danh sách ID Admin đã quét được:", Array.from(adminEmployeeIds));

      // 2. Lọc: Chỉ giữ lại những nhân viên KHÔNG nằm trong danh sách Admin
      const nonAdminEmployees = (empData.data || []).filter(emp => {
        // Cửa ải 1: Quét ID (Dành cho Admin khi đã lấy được danh sách tài khoản)
        if (adminEmployeeIds.has(String(emp.MaNhanVien)) || adminEmployeeIds.has(String(emp.id))) {
          return false; 
        }
        
        // Cửa ải 2: Quét trực tiếp trên dữ liệu nhân viên (Dành cho Manager)
        // Dù Backend trả về object lồng nhau thế nào cũng sẽ bắt được MaVaiTro = 1
        const possibleRoleIds = [String(emp.MaVaiTro), String(emp.role), String(emp.roleId), String(emp.TaiKhoan?.MaVaiTro), String(emp.VaiTro?.MaVaiTro)];
        const possibleRoleNames = [String(emp.TenVaiTro).toLowerCase(), String(emp.roleName).toLowerCase(), String(emp.TaiKhoan?.TenVaiTro).toLowerCase()];

        // Có số 1 (Admin) -> Bỏ qua
        if (possibleRoleIds.includes("1")) return false;
        
        // Có chữ admin -> Bỏ qua
        if (possibleRoleNames.some(name => name.includes("admin"))) return false;

        // An toàn -> Giữ lại
        return true; 
      });
      
      setEmployeeList(nonAdminEmployees);
    } catch (err) {
      setError(err.message || "Lỗi kết nối Server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  // Tự động nhảy về trang 1 khi tìm kiếm hoặc thay đổi số lượng dòng
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  // Đồng bộ ô nhập trang nhanh
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Hàm mở modal xem ảnh lớn
  const handleZoomImage = (imgSrc) => {
    if (!imgSrc) return;
    const fullUrl = String(imgSrc).startsWith('http') ? imgSrc : `${SERVER_URL}${String(imgSrc).startsWith('/') ? '' : '/'}${imgSrc}`;
    setZoomedImage(fullUrl);
  };

  // Xử lý chọn file ảnh từ máy tính
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImageFile(file);
    }
  };

  // 2. MỞ FORM THÊM NHÂN VIÊN MỚI
  const handleOpenCreate = () => {
    setIsEditMode(false);
    setSelectedId(null);
    setFormData({
      TenNhanVien: "",
      NgaySinh: "",
      GioiTinh: true,
      SDT: "",
      Email: "",
      CCCD: "",
      DiaChi: "",
      AnhDaiDien: "https://i.pravatar.cc/150?img=68",
      TrangThai: true
    });
    setSelectedImageFile(null);
    setIsModalOpen(true);
  };

  // 3. MỞ FORM CẬP NHẬT NHÂN VIÊN
  const handleOpenEdit = (row) => {
    setIsEditMode(true);
    setSelectedId(row.MaNhanVien); // Khớp chuẩn khóa chính MaNhanVien từ câu lệnh SELECT của BE
    setFormData({
      TenNhanVien: row.TenNhanVien || "",
      NgaySinh: row.NgaySinh ? (() => {
        const d = new Date(row.NgaySinh);
        if (isNaN(d.getTime())) return "";
        // Đảm bảo định dạng YYYY-MM-DD cho input type="date"
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      })() : "",
      GioiTinh: row.GioiTinh ?? true,
      SDT: row.SDT || "",
      Email: row.Email || "",
      CCCD: row.CCCD || "",
      DiaChi: row.DiaChi || "",
      AnhDaiDien: row.AnhDaiDien || "https://i.pravatar.cc/150?img=68",
      TrangThai: row.TrangThai ?? true
    });
    setSelectedImageFile(null);
    setIsModalOpen(true);
  };

  // 4. KIỂM TRA VALIDATION PHÍA FRONTEND & SUBMIT DỮ LIỆU
  const handleSubmitForm = async (e) => {
    e.preventDefault();

    if (!formData.TenNhanVien.trim()) {
      return alert("Họ và tên nhân viên bắt buộc nhập!");
    }

    if (formData.SDT && (formData.SDT.length < 10 || formData.SDT.length > 11)) {
      return alert("Số điện thoại không hợp lệ! Phải có độ dài từ 10 đến 11 chữ số.");
    }

    try {
      const token = getToken();
      const formDataObj = new FormData();
      
      // Đóng gói dữ liệu vào FormData
      formDataObj.append("TenNhanVien", formData.TenNhanVien.trim());
      formDataObj.append("NgaySinh", formData.NgaySinh || "");
      formDataObj.append("GioiTinh", formData.GioiTinh ? 1 : 0);
      formDataObj.append("SDT", formData.SDT || "");
      formDataObj.append("Email", formData.Email || "");
      formDataObj.append("CCCD", formData.CCCD || "");
      formDataObj.append("DiaChi", formData.DiaChi || "");
      formDataObj.append("TrangThai", formData.TrangThai ? 1 : 0);

      // Nếu có chọn file mới thì đính kèm vào field 'AnhDaiDien' để Backend Multer xử lý
      if (selectedImageFile) {
        formDataObj.append("AnhDaiDien", selectedImageFile);
      }

      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      let res;
      if (isEditMode) {
        res = await axios.put(`${SERVER_URL}/nhanvien/capnhat/${selectedId}`, formDataObj, config);
      } else {
        res = await axios.post(`${SERVER_URL}/nhanvien/taonhanvien`, formDataObj, config);
      }

      if (res.data.success) {
        alert(res.data.message || "Xử lý thông tin nhân sự thành công!");
        setIsModalOpen(false);
        await loadEmployees();
      }
    } catch (err) {
      alert("Lỗi hệ thống: " + (err.response?.data?.message || err.message));
    }
  };

  // 5. XÓA MỀM NHÂN VIÊN
  const handleDeleteEmployee = async (id, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa nhân sự [${name}] không?`)) return;

    try {
      // 🎯 Đã sửa khớp Endpoint BE: /xoanhanvien/:id
      const response = await fetch(`http://localhost:3000/nhanvien/xoanhanvien/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        }
      });
      const res = await response.json();
      if (response.ok && res.success) {
        alert(res.message || "Xóa trạng thái hoạt động của nhân viên thành công!");
        await loadEmployees();
      } else {
        alert("Không thể thực hiện lệnh xóa: " + res.message);
      }
    } catch (err) {
      alert("Hệ thống phát sinh lỗi khi xóa: " + err.message);
    }
  };

  // 6. BỘ LỌC TÌM KIẾM ĐA NĂNG
  const filteredEmployees = useMemo(() => {
    return employeeList.filter((item) => {
      const search = searchTerm.toLowerCase().trim();
      if (!search) return true;
      return (
        (item.TenNhanVien && item.TenNhanVien.toLowerCase().includes(search)) ||
        (item.SDT && String(item.SDT).toLowerCase().includes(search)) ||
        (item.Email && item.Email.toLowerCase().includes(search)) ||
        (item.CCCD && String(item.CCCD).toLowerCase().includes(search)) ||
        (item.MaNhanVien && String(item.MaNhanVien).includes(search))
      );
    });
  }, [employeeList, searchTerm]);

  // 🔢 TOÁN TỬ PHÂN TRANG CHUẨN ĐỒNG BỘ
  const totalItems = filteredEmployees.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  
  const paginatedEmployees = useMemo(() => {
    return filteredEmployees.slice(indexOfFirstItem, indexOfLastItem);
  }, [filteredEmployees, indexOfFirstItem, indexOfLastItem]);

  // Tự động reset trang khi tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const handlePageInputBlurOrEnter = (e) => {
    if (e.key && e.key !== "Enter") return;
    let targetPage = parseInt(pageInput, 10);
    if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
    if (targetPage > totalPages) targetPage = totalPages;
    setCurrentPage(targetPage);
    setPageInput(String(targetPage));
  };

  return (
    <MainLayout>
      {/* Khối tiêu đề đầu trang */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Quản lý Nhân sự </h2>
          <p className="text-sm text-gray-400 mt-1">Hồ sơ thông tin điều phối và phân phối nhân sự hệ thống</p>
        </div>
        
        {/* 🔐 Cập nhật logic canManage để Manager (Role 2) không bị mất nút */}
        {canManage && (
          <button
            onClick={handleOpenCreate}
            className="rounded-xl bg-blue-600 px-4 py-2 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition-all flex items-center gap-1"
          >
            <UserPlus size={14}/> Thêm nhân viên mới
          </button>
        )}
      </div>

      {/* 🔍 SEARCH & FILTER BAR (Layout thông minh từ ApprovePage) */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 relative">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tìm kiếm hồ sơ nhân sự</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
              <input
                type="text"
                placeholder="Nhập tên, số điện thoại, CCCD hoặc email nhân viên..."
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
              <option value={5}>5 nhân sự / trang</option>
              <option value={10}>10 nhân sự / trang</option>
              <option value={20}>20 nhân sự / trang</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trạng thái mạng */}
      {loading && <p className="text-sm text-gray-500 animate-pulse my-4">Đang kết nối hệ thống dữ liệu nhân sự...</p>}
      {error && <p className="text-sm text-red-500 mb-4 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}

      {/* 📊 BẢNG DỮ LIỆU ĐỐI TƯỢNG NHÂN VIÊN */}
      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <DataTable
            columns={[
              {
                key: "TenNhanVien",
                label: "Mã & Tên Nhân sự",
                render: (_, row) => (
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-9 h-9 rounded-full overflow-hidden border border-gray-200 shadow-xs bg-gray-50 flex items-center justify-center shrink-0 cursor-zoom-in hover:opacity-80 transition-all"
                      onClick={() => handleZoomImage(row.AnhDaiDien || row.image || row.avatar)}
                    >
                      <img 
                        src={
                          row.AnhDaiDien || row.image || row.avatar
                            ? (String(row.AnhDaiDien || row.image || row.avatar).startsWith('http') 
                                ? (row.AnhDaiDien || row.image || row.avatar) 
                                : `${SERVER_URL}${String(row.AnhDaiDien || row.image || row.avatar).startsWith('/') ? '' : '/'}${row.AnhDaiDien || row.image || row.avatar}`)
                            : "https://i.pravatar.cc/150?img=68"
                        } 
                        alt="avatar" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{row.TenNhanVien}</p>
                      <p className="text-[10px] font-mono font-medium text-gray-400">ID: #{row.MaNhanVien}</p>
                    </div>
                  </div>
                )
              },
              { key: "GioiTinh", label: "Giới tính", render: (v) => (v ? "👨 Nam" : "👩 Nữ") },
              { key: "SDT", label: "Số điện thoại", render: (v) => v || <span className="text-gray-400 italic text-xs">Chưa nhập</span> },
              { key: "Email", label: "Hộp thư Email", render: (v) => <span className="text-gray-600 text-xs">{v || "—"}</span> },
              { key: "CCCD", label: "Căn cước công dân", render: (v) => <span className="font-mono text-gray-500 text-xs">{v || "—"}</span> },
              {
                key: "TrangThai",
                label: "Trạng thái",
                render: (v) => (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold inline-block ${
                    v ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"
                  }`}>
                    {v ? "Đang làm việc" : "Ngừng làm việc"}
                  </span>
                )
              },
              {
                key: "actions",
                label: "Thao tác",
                render: (_, row) => (
                  <div className="flex space-x-2 items-center">
                    {/* 🔐 Sử dụng biến canManage đã tính toán từ service auth */}
                    {canManage ? (
                      <button
                        onClick={() => handleOpenEdit(row)}
                        className="text-blue-600 hover:text-blue-800 text-xs bg-blue-50 px-2.5 py-1.5 rounded-lg font-semibold transition-all"
                      >
                        Sửa
                      </button>
                    ) : (
                      <span className="text-gray-300 text-xs italic select-none">Chỉ xem</span>
                    )}

                    {/* 🔐 Mở quyền Xóa cho Manager nếu bạn muốn cấp quyền này cho Role 2 */}
                    {canManage && (
                      <button
                        onClick={() => handleDeleteEmployee(row.MaNhanVien, row.TenNhanVien)}
                        className="text-red-600 hover:text-red-800 text-xs bg-red-50 px-2.5 py-1.5 rounded-lg font-semibold transition-all"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                )
              }
            ]}
            data={paginatedEmployees}
          />

          {totalItems === 0 && (
            <div className="px-6 py-12 text-center text-gray-400 bg-gray-50/30 text-sm">
              📭 Không tìm thấy kết quả hồ sơ nhân viên phù hợp.
            </div>
          )}
        </div>
      )}

      {/* 🔢 THANH PHÂN TRANG TIỆN ÍCH (Layout đồng bộ ApprovePage) */}
      {!loading && !error && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-500">
          <div>
            Hiển thị từ <span className="font-bold text-gray-800">{indexOfFirstItem + 1}</span> -{" "}
            <span className="font-bold text-gray-800">{Math.min(indexOfLastItem, totalItems)}</span> trên{" "}
            <span className="font-bold text-gray-800">{totalItems}</span> nhân viên
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

      {/* 📄 MODAL BIỂU MẪU ĐIỀN THÔNG TIN NHÂN VIÊN */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all border border-gray-100 flex flex-col">
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-base">
                {isEditMode ? `✏️ Cập nhật thông tin: ${formData.TenNhanVien}` : "➕ Đăng ký hồ sơ nhân sự mới"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold focus:outline-none">&times;</button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              
              {/* Họ tên nhân viên */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Họ và tên nhân viên <span className="text-red-500">*</span></label>
                <input
                  type="text" required placeholder="Nhập họ và tên đầy đủ của nhân viên..."
                  className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.TenNhanVien}
                  onChange={(e) => setFormData({ ...formData, TenNhanVien: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Ngày sinh */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Ngày tháng năm sinh</label>
                  <input
                    type="date" className="w-full border rounded-lg p-2 text-sm bg-white text-gray-700"
                    value={formData.NgaySinh}
                    onChange={(e) => setFormData({ ...formData, NgaySinh: e.target.value })}
                  />
                </div>

                {/* Giới tính */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Giới tính</label>
                  <div className="flex items-center space-x-6 mt-2">
                    <label className="flex items-center text-sm font-medium text-gray-700 cursor-pointer">
                      <input
                        type="radio" name="gioitinh" className="mr-1.5 h-4 w-4 text-blue-600 focus:ring-blue-500"
                        checked={formData.GioiTinh === true}
                        onChange={() => setFormData({ ...formData, GioiTinh: true })}
                      />
                      Nam
                    </label>
                    <label className="flex items-center text-sm font-medium text-gray-700 cursor-pointer">
                      <input
                        type="radio" name="gioitinh" className="mr-1.5 h-4 w-4 text-blue-600 focus:ring-blue-500"
                        checked={formData.GioiTinh === false}
                        onChange={() => setFormData({ ...formData, GioiTinh: false })}
                      />
                      Nữ
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Số điện thoại */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Số điện thoại di động</label>
                  <input
                    type="text" maxLength={11} placeholder="Khống chế từ 10 - 11 chữ số..."
                    className="w-full border rounded-lg p-2 text-sm bg-white font-mono"
                    value={formData.SDT}
                    onChange={(e) => setFormData({ ...formData, SDT: e.target.value.replace(/\D/g, "") })}
                  />
                </div>

                {/* Số CCCD */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Số thẻ căn cước (CCCD)</label>
                  <input
                    type="text" placeholder="Nhập mã số CCCD định danh..."
                    className="w-full border rounded-lg p-2 text-sm bg-white font-mono"
                    value={formData.CCCD}
                    onChange={(e) => setFormData({ ...formData, CCCD: e.target.value.replace(/\D/g, "") })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Hộp thư Email */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Địa chỉ Email liên hệ</label>
                  <input
                    type="email" placeholder="name@company.com"
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                    value={formData.Email}
                    onChange={(e) => setFormData({ ...formData, Email: e.target.value })}
                  />
                </div>

                {/* CHỌN ẢNH TỪ MÁY TÍNH */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Ảnh đại diện nhân viên</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      onChange={handleImageChange}
                    />
                    {/* Preview ảnh đang chọn hoặc ảnh cũ */}
                    {(selectedImageFile || formData.AnhDaiDien) && (
                      <div 
                        className="w-10 h-10 rounded-full border border-gray-200 overflow-hidden shrink-0 shadow-sm cursor-zoom-in hover:ring-2 ring-blue-500 transition-all"
                        onClick={() => handleZoomImage(selectedImageFile ? URL.createObjectURL(selectedImageFile) : formData.AnhDaiDien)}
                      >
                        <img 
                          src={selectedImageFile 
                            ? URL.createObjectURL(selectedImageFile) 
                            : (formData.AnhDaiDien && String(formData.AnhDaiDien).startsWith('http') 
                                ? formData.AnhDaiDien 
                                : (formData.AnhDaiDien 
                                    ? `${SERVER_URL}${String(formData.AnhDaiDien).startsWith('/') ? '' : '/'}${formData.AnhDaiDien}`
                                    : "https://i.pravatar.cc/150?img=68"))
                          } 
                          alt="preview" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Địa chỉ nơi ở */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Địa chỉ thường trú / Nơi ở hiện tại</label>
                <textarea
                  rows="2" placeholder="Số nhà, tên đường, khu phố, tỉnh thành..."
                  className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.DiaChi}
                  onChange={(e) => setFormData({ ...formData, DiaChi: e.target.value })}
                />
              </div>

              {/* Trạng thái công việc */}
              <div className="bg-gray-50 p-3 rounded-lg border flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-700 uppercase">Trạng thái công tác</p>
                  <p className="text-xs text-gray-400 mt-0.5">Xác định nhân sự còn đang làm việc tại tổng kho hay không</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox" className="sr-only peer"
                    checked={formData.TrangThai === true}
                    onChange={(e) => setFormData({ ...formData, TrangThai: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Nút bấm tác vụ của Form */}
              <div className="flex justify-end items-center pt-4 border-t space-x-2">
                <button
                  type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md transition-all"
                >
                  {isEditMode ? "Cập Nhật Hồ Sơ" : "Lưu & Khởi Tạo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XEM ẢNH PHÓNG TO */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-2xl max-h-[80vh]">
            <button className="absolute -top-10 right-0 text-white hover:text-gray-300 font-bold text-xl">✕ Đóng</button>
            <img 
              src={zoomedImage} 
              alt="Large view" 
              className="w-full h-full object-contain rounded-full border-4 border-white shadow-2xl" 
            />
          </div>
        </div>
      )}
    </MainLayout>
  );
}