import { useEffect, useState, useMemo } from "react";
import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable";
import { Search, Users, UserPlus, MapPin, Mail, Contact } from "lucide-react";

export default function CustomerPage() {
  const [customerList, setCustomerList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // 🔢 Thêm trạng thái Phân trang & Giới hạn hiển thị
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState("1");

  // Trạng thái Modal Form (Tạo mới / Sửa khách hàng)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  
  const [formData, setFormData] = useState({
    MaKHCode: "",
    TenKH: "",
    SDT: "",
    Email: "",
    DiaChi: ""
  });

  const getToken = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";

  // 1. TẢI DANH SÁCH KHÁCH HÀNG TỪ BACKEND
  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("http://localhost:3000/khachhang/danhsach", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        }
      });
      const res = await response.json();
      if (res.success) {
        setCustomerList(res.data || []);
      } else {
        throw new Error(res.message || "Không thể tải danh sách khách hàng.");
      }
    } catch (err) {
      setError(err.message || "Lỗi kết nối Server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Tự động reset về trang 1 khi người dùng thay đổi từ khóa tìm kiếm hoặc đổi số lượng dòng/trang
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  // Đồng bộ ô nhập số trang khi trang hiện tại thay đổi
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // 2. MỞ MODAL THÊM KHÁCH HÀNG
  const handleOpenCreate = () => {
    setIsEditMode(false);
    setSelectedId(null);
    setFormData({
      MaKHCode: "", 
      TenKH: "",
      SDT: "",
      Email: "",
      DiaChi: ""
    });
    setIsModalOpen(true);
  };

  // 3. MỞ MODAL SỬA KHÁCH HÀNG
  const handleOpenEdit = (row) => {
    setIsEditMode(true);
    setSelectedId(row.MaKH);
    setFormData({
      MaKHCode: row.MaKHCode || "",
      TenKH: row.TenKH || "",
      SDT: row.SDT || "",
      Email: row.Email || "",
      DiaChi: row.DiaChi || ""
    });
    setIsModalOpen(true);
  };

  // 4. GỬI DỮ LIỆU LÊN SERVER (LƯU / CẬP NHẬT)
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.TenKH.trim()) {
      alert("Tên khách hàng không được để trống!");
      return;
    }

    try {
      const url = isEditMode
        ? `http://localhost:3000/khachhang/capnhatkhach/${selectedId}`
        : "http://localhost:3000/khachhang/taokhachhang";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        },
        body: JSON.stringify(formData)
      });

      const res = await response.json();
      if (res.success) {
        alert(res.message || "Thao tác thành công!");
        setIsModalOpen(false);
        await loadCustomers(); 
      } else {
        alert("Lỗi từ backend: " + res.message);
      }
    } catch (err) {
      alert("Lỗi kết nối: " + err.message);
    }
  };

  // 5. XỬ LÝ XÓA MỀM KHÁCH HÀNG
  const handleDeleteCustomer = async (id, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa khách hàng [${name}] này không? Thao tác này sẽ chuyển vào thùng rác.`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/khachhang/xoa/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        }
      });
      const res = await response.json();
      if (res.success) {
        alert("Xóa khách hàng thành công!");
        await loadCustomers();
      } else {
        alert("Không thể xóa: " + res.message);
      }
    } catch (err) {
      alert("Lỗi hệ thống khi xóa: " + err.message);
    }
  };

  // 6. LOGIC LỌC DỮ LIỆU TÌM KIẾM
  const filteredCustomers = useMemo(() => {
    return customerList.filter((item) => {
      const search = searchTerm.toLowerCase().trim();
      if (!search) return true;
      return (
        (item.TenKH && item.TenKH.toLowerCase().includes(search)) ||
        (item.SDT && String(item.SDT).toLowerCase().includes(search)) ||
        (item.Email && item.Email.toLowerCase().includes(search)) ||
        (item.MaKHCode && item.MaKHCode.toLowerCase().includes(search))
      );
    });
  }, [customerList, searchTerm]);

  // 🔢 TOÁN TỬ PHÂN TRANG CHUẨN (Thừa hưởng từ layout gốc)
  const totalItems = filteredCustomers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  const paginatedCustomers = useMemo(() => {
    return filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);
  }, [filteredCustomers, indexOfFirstItem, indexOfLastItem]);

  // Tự động reset trang khi tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  // Xử lý sự kiện nhảy trang khi nhập số hoặc Blur ô nhập trang
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
      {/* Khối Tiêu đề & Nút Thêm mới */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Quản lý Khách hàng</h2>
          <p className="text-sm text-gray-400 mt-1">Quản lý danh sách đối tác và khách hàng nhận xuất kho</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="rounded-xl bg-blue-600 px-4 py-2 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition-all flex items-center gap-1"
        >
            <UserPlus size={14}/> Thêm khách hàng
        </button>
      </div>

      {/* KPI STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-xs"><Users size={20}/></div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng khách hàng</p>
            <h3 className="text-xl font-bold text-gray-800">{customerList.length} <span className="text-xs font-normal text-gray-400">Đối tác</span></h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-xs"><Mail size={20}/></div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email liên hệ</p>
            <h3 className="text-xl font-bold text-emerald-600">{customerList.filter(c => c.Email).length} <span className="text-xs font-normal text-gray-400">Địa chỉ</span></h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-xs"><Contact size={20}/></div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tình trạng kết nối</p>
            <h3 className="text-xl font-bold text-indigo-600">Hoạt động</h3>
          </div>
        </div>
      </div>

      {/* 🔍 SEARCH & FILTER BAR (Layout thông minh đồng bộ) */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 relative">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tìm kiếm khách hàng</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
              <input
                type="text"
                placeholder="Nhập tên khách hàng, số điện thoại hoặc mã đối tác..."
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
              <option value={5}>5 dòng / trang</option>
              <option value={10}>10 dòng / trang</option>
              <option value={20}>20 dòng / trang</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trạng thái hiển thị hệ thống */}
      {loading && <p className="text-sm text-gray-500 animate-pulse my-4">Đang tải danh sách khách hàng...</p>}
      {error && <p className="text-sm text-red-500 mb-4 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}

      {/* Bảng Dữ liệu Đối tác */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <DataTable
            columns={[
              {
                key: "MaKHCode",
                label: "Mã khách hàng",
                render: (v) => <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs">{v || "—"}</span>
              },
              { key: "TenKH", label: "Tên đối tác / Khách hàng" },
              { key: "SDT", label: "Số điện thoại", render: (v) => v || <span className="text-gray-400 italic text-xs">Chưa cập nhật</span> },
              { key: "Email", label: "Hộp thư Email", render: (v) => v || <span className="text-gray-400 italic text-xs">Chưa cập nhật</span> },
              { key: "DiaChi", label: "Địa chỉ nhận hàng", render: (v) => v || <span className="text-gray-400 italic text-xs">Chưa cập nhật</span> },
              {
                key: "actions",
                label: "Hành động",
                render: (_, row) => (
                  <div className="flex space-x-2 items-center">
                    <button
                      onClick={() => handleOpenEdit(row)}
                      className="text-amber-600 hover:text-amber-800 text-xs bg-amber-50 px-2.5 py-1.5 rounded-lg font-semibold transition-all"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(row.MaKH, row.TenKH)}
                      className="text-red-600 hover:text-red-800 text-xs bg-red-50 px-2.5 py-1.5 rounded-lg font-semibold transition-all"
                    >
                      Xóa
                    </button>
                  </div>
                )
              }
            ]}
            data={paginatedCustomers} // Chỉ truyền cục dữ liệu đã cắt theo phân trang
          />
          
          {totalItems === 0 && (
            <div className="px-6 py-12 text-center text-gray-400 bg-gray-50/30 text-sm">
              📭 Không tìm thấy kết quả khách hàng nào trùng khớp.
            </div>
          )}
        </div>
      )}

      {/* 🔢 THANH ĐIỀU HƯỚNG PHÂN TRANG CHUẨN ĐỒNG BỘ (Style ApprovePage) */}
      {!loading && !error && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-500">
          <div>
            Hiển thị từ <span className="font-bold text-gray-800">{indexOfFirstItem + 1}</span> -{" "}
            <span className="font-bold text-gray-800">{Math.min(indexOfLastItem, totalItems)}</span> trên{" "}
            <span className="font-bold text-gray-800">{totalItems}</span> khách hàng
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

      {/* ─── MODAL ĐIỀN FORM (TẠO MỚI HOẶC SỬA) ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-base">
                {isEditMode ? `Cập nhật thông tin: ${formData.TenKH}` : "Thêm mới đối tác khách hàng"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold focus:outline-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {/* Ô Mã KHCode */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase">Mã số khách hàng</label>
                <input
                  type="text"
                  placeholder={isEditMode ? "" : "Bỏ trống để hệ thống tự động tạo mã ngẫu nhiên"}
                  disabled={isEditMode} 
                  className={`w-full border rounded-lg p-2 text-sm font-mono ${isEditMode ? "bg-gray-100 font-bold text-gray-500" : "bg-white"}`}
                  value={formData.MaKHCode}
                  onChange={(e) => setFormData({ ...formData, MaKHCode: e.target.value })}
                />
              </div>

              {/* Ô Tên Khách Hàng */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase">Tên khách hàng / Tên doanh nghiệp <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Nhập họ tên cá nhân hoặc tên công ty..."
                  className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.TenKH}
                  onChange={(e) => setFormData({ ...formData, TenKH: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Ô Số điện thoại */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase">Số điện thoại</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 0912xxxxxx"
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                    value={formData.SDT}
                    onChange={(e) => setFormData({ ...formData, SDT: e.target.value })}
                  />
                </div>

                {/* Ô Email */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase">Địa chỉ Email</label>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                    value={formData.Email}
                    onChange={(e) => setFormData({ ...formData, Email: e.target.value })}
                  />
                </div>
              </div>

              {/* Ô Địa chỉ */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase">Địa chỉ văn phòng / Nhà kho</label>
                <textarea
                  rows="2"
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                  className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.DiaChi}
                  onChange={(e) => setFormData({ ...formData, DiaChi: e.target.value })}
                />
              </div>

              {/* Nút tác vụ dưới Form */}
              <div className="flex justify-end items-center pt-4 border-t space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md transition-all"
                >
                  {isEditMode ? "Cập Nhật Khách Hàng" : "Lưu & Khởi Tạo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}