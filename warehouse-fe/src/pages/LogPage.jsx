import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable";

export default function LogPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ homNay: 0, tongTatCa: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageInput, setPageInput] = useState("1");

  // 🔢 Tính toán dải hiển thị (Fix lỗi ReferenceError gây treo trang)
  const indexOfFirstItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const indexOfLastItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + logs.length;

  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const getToken = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";

  const loadThongKeLog = async () => {
    try {
      const response = await fetch("http://localhost:3000/logs/thong-ke", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        }
      });
      const res = await response.json();
      if (res.success) {
        setStats({
          homNay: res.data.homNay || 0,
          tongTatCa: res.data.tongTatCa || 0
        });
      }
    } catch (err) {
      console.error("Không thể tải thống kê log:", err);
    }
  };

const loadDanhSachLog = async (isMounted) => {
  try {
    setLoading(true);
    setError("");

    const queryParams = new URLSearchParams();
    queryParams.append("trang", currentPage);
    queryParams.append("soLuong", itemsPerPage);

    const trimmedSearch = searchTerm.trim();
    if (trimmedSearch) queryParams.append("tuKhoa", trimmedSearch);
    if (actionFilter) queryParams.append("hanhDong", actionFilter);
    if (startDate) queryParams.append("tuNgay", startDate);
    if (endDate) queryParams.append("denNgay", endDate);

    const response = await fetch(`http://localhost:3000/logs?${queryParams.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`
      }
    });

    const res = await response.json();
    
    if (res.success && isMounted) {
      // 🛠️ Lọc bỏ triệt để các log "VIEW/XEM" để tránh tràn dữ liệu và giải quyết nhầm lẫn bảng
      const allFetchedLogs = res.data.logs || [];
      const nonViewLogs = allFetchedLogs.filter(log => {
        const act = log.HanhDong?.toLowerCase() || "";
        return !act.includes("view") && !act.includes("xem") && !act.includes("truy cập");
      });
      setLogs(nonViewLogs);
      setTotalItems(res.data.phanTrang.tongSo || 0);
      setTotalPages(res.data.phanTrang.tongTrang || 1);
    } else if (!res.success) {
      throw new Error(res.message || "Không thể tải danh sách nhật ký.");
    }
  } catch (err) {
    setError(err.message || "Lỗi kết nối Server.");
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    loadThongKeLog();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      loadDanhSachLog(isMounted);
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [currentPage, itemsPerPage, actionFilter, startDate, endDate, searchTerm]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handleOpenDetail = async (id) => {
    try {
      setIsModalOpen(true);
      setModalLoading(true);
      const response = await fetch(`http://localhost:3000/logs/${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        }
      });
      const res = await response.json();
      if (res.success) {
        setSelectedLog(res.data);
      } else {
        alert(res.message || "Không tìm thấy chi tiết bản ghi log này.");
        setIsModalOpen(false);
      }
    } catch (err) {
      alert("Lỗi kết nối: " + err.message);
      setIsModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  const formatTableName = (tableName) => {
    const mapping = {
      "SanPham": "Sản phẩm",
      "TonKho": "Tồn kho", 
      "DanhMuc": "Danh mục",
      "DonViTinh": "Đơn vị tính",
      "TaiKhoan": "Tài khoản",
      "NhanVien": "Nhân viên",
      "PhieuNhap": "Phiếu nhập",
      "PhieuXuat": "Phiếu xuất",
      "NhaCungCap": "Nhà cung cấp",
      "KhachHang": "Khách hàng",
      "Kho": "Kho",
      "ViTriKho": "Vị trí kho",
      "PhanQuyen": "Phân quyền",
      "VaiTro": "Vai trò",
      "QuyenHan": "Quyền hạn"
    };
    return mapping[tableName] || tableName;
  };

  const handlePageInputBlurOrEnter = (e) => {
    if (e.key && e.key !== "Enter") return;
    let targetPage = parseInt(pageInput, 10);
    if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
    if (targetPage > totalPages) targetPage = totalPages;
    setCurrentPage(targetPage);
    setPageInput(String(targetPage));
  };

  const parseAction = (action) => {
    const act = action?.trim().toLowerCase() || "";
    if (act.includes("create") || act.includes("thêm mới")) {
      return { text: "Thêm mới", color: "bg-green-50 text-green-700 border-green-200" };
    }
    if (act.includes("update") || act.includes("cập nhật") || act.includes("sửa")) {
      return { text: "Cập nhật", color: "bg-blue-50 text-blue-700 border-blue-200" };
    }
    if (act.includes("delete") || act.includes("xóa")) {
      return { text: "Xóa", color: "bg-red-50 text-red-700 border-red-200" };
    }
    if (act.includes("import") || act.includes("nhập")) return { text: "Phiếu nhập", color: "bg-indigo-50 text-indigo-700 border-indigo-200" };
    if (act.includes("export") || act.includes("xuất")) return { text: "Phiếu xuất", color: "bg-orange-50 text-orange-700 border-orange-200" };
    return { text: action, color: "bg-gray-50 text-gray-700 border-gray-200" };
  };

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Nhật ký Hệ thống </h2>
          <p className="text-sm text-gray-400 mt-1">Giám sát và kiểm tra toàn bộ lịch sử thao tác dữ liệu của nhân sự</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div 
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            setStartDate(today);
            setEndDate(today);
          }}
          className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-4 rounded-xl border flex items-center justify-between shadow-sm 
            ${(startDate === new Date().toISOString().split('T')[0] && endDate === new Date().toISOString().split('T')[0]) 
              ? "border-amber-500 ring-2 ring-amber-500/10 shadow-md" 
              : "border-gray-100 hover:border-amber-200"}`}
        >
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Thao tác hôm nay</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">{stats.homNay} <span className="text-xs text-gray-400 font-normal">Log phát sinh</span></h3>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg transition-colors 
            ${(startDate === new Date().toISOString().split('T')[0] && endDate === new Date().toISOString().split('T')[0]) 
              ? "bg-amber-500 text-white" 
              : "bg-amber-50 text-amber-500"}`}>⚡</div>
        </div>

        <div 
          onClick={() => { setSearchTerm(""); setActionFilter(""); setStartDate(""); setEndDate(""); }}
          className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-4 rounded-xl border flex items-center justify-between shadow-sm 
            ${(!searchTerm && !actionFilter && !startDate && !endDate) 
              ? "border-blue-500 ring-2 ring-blue-500/10 shadow-md" 
              : "border-gray-100 hover:border-blue-200"}`}
        >
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tổng tích lũy cơ sở dữ liệu</p>
            <h3 className="text-2xl font-bold text-blue-600 mt-1">{stats.tongTatCa} <span className="text-xs text-gray-400 font-normal">Bản ghi</span></h3>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg transition-colors 
            ${(!searchTerm && !actionFilter && !startDate && !endDate) 
              ? "bg-blue-500 text-white" 
              : "bg-blue-50 text-blue-500"}`}>📁</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase">Tìm kiếm nhanh</label>
            <input
              type="text"
              placeholder="Tên nhân viên, hành động..."
              className="w-full pl-3 pr-8 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button 
                onClick={() => { setSearchTerm(""); setCurrentPage(1); }} 
                className="absolute right-2.5 top-7 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                &times;
              </button>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase">Hành động</label>
            <select
              className="w-full border border-gray-200 rounded-lg p-1.5 text-xs bg-white focus:outline-none font-medium text-gray-700"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">— Tất cả hành động —</option>
              <option value="Thêm mới">Thêm mới</option>
              <option value="Cập nhật">Cập nhật</option>
              <option value="Xóa">Xóa</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase">Từ ngày</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg p-1.5 text-xs bg-white text-gray-600"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase">Đến ngày</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg p-1.5 text-xs bg-white text-gray-600"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3 text-xs text-gray-500">
          <div className="flex items-center space-x-2">
            <span>Dòng hiển thị trên bảng:</span>
            <select
              className="border rounded px-1.5 py-0.5 bg-white focus:outline-none text-xs"
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            >
              <option value={10}>10 dòng</option>
              <option value={20}>20 dòng</option>
              <option value={50}>50 dòng</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500 animate-pulse my-4">Đang truy xuất dữ liệu lịch sử thao tác...</p>}
      {error && <p className="text-sm text-red-500 mb-4 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <DataTable
            columns={[
              {
                key: "MaLichSu",
                label: "Mã Log ID",
                render: (v) => <span className="font-mono font-bold text-gray-400 text-xs">#{v}</span>
              },
              {
                key: "TenNhanVien",
                label: "Người thực hiện",
                render: (v, row) => (
                  <div>
                    <p className="font-semibold text-gray-800 text-xs">{v || "Hệ thống tự động"}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{row.Email || "system@internal"}</p>
                  </div>
                )
              },
              {
                key: "CCCD",
                label: "Số CCCD",
                render: (v) => <span className="font-mono text-gray-600 text-xs">{v || "—"}</span>
              },
              {
                key: "HanhDong",
                label: "Hành động",
                render: (v) => {
                  const actionData = parseAction(v);
                  return (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${actionData.color}`}>
                      {actionData.text}
                    </span>
                  );
                }
              },
              {
                key: "BangTacDong",
                label: "Bảng dữ liệu tác động",
                render: (v) => (
                  <span className="font-mono text-xs bg-gray-50 px-1.5 py-0.5 rounded text-gray-600">
                    {formatTableName(v) || "N/A"}
                  </span>
                )
              },
              {
                key: "NoiDungMoi",
                label: "Tóm tắt nội dung thao tác",
                render: (v) => (
                  <p className="text-xs text-gray-600 max-w-xs truncate" title={v}>
                    {v || <span className="text-gray-300 italic">Không có mô tả</span>}
                  </p>
                )
              },
              {
                key: "ThoiGian",
                label: "Thời gian thực thi",
                render: (v) => (
                  <span className="text-xs text-gray-500 font-medium">
                    {v ? new Date(v).toLocaleString("vi-VN") : "—"}
                  </span>
                )
              },
              {
                key: "actions",
                label: "Chi tiết",
                render: (_, row) => (
                  <button
                    onClick={() => handleOpenDetail(row.MaLichSu)}
                    className="text-blue-600 hover:text-blue-800 text-xs bg-blue-50 px-2 py-1 rounded font-semibold transition-all"
                  >
                    🔍 Xem sâu
                  </button>
                )
              }
            ]}
            data={logs}
          />

          {logs.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-400 bg-gray-50/30 text-sm">
              📭 Không tìm thấy dữ liệu lịch sử thao tác nào khớp với bộ lọc của bạn.
            </div>
          )}
        </div>
      )}

      {/* 🔢 THANH ĐIỀU HƯỚNG PHÂN TRANG (ĐÃ ĐƯỢC FIX SỐ DÒNG HIỂN THỊ) */}
      {!loading && !error && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-sm text-gray-600">
          <div>
            Hiển thị từ <span className="font-semibold text-gray-800">{indexOfFirstItem}</span> đến{" "}
            <span className="font-semibold text-gray-800">{indexOfLastItem}</span>{" "}
            trong tổng số khoảng <span className="font-semibold text-gray-800">{totalItems}</span> dòng kết quả
          </div>

          <div className="flex items-center space-x-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)} className="px-2 py-1 rounded border border-gray-200 bg-white disabled:opacity-40 text-xs font-medium hover:bg-gray-50">&laquo; Đầu</button>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => prev - 1)} className="px-2 py-1 rounded border border-gray-200 bg-white disabled:opacity-40 text-xs font-medium hover:bg-gray-50">&lsaquo; Trước</button>

            <div className="flex items-center space-x-1.5 px-2 py-0.5 border border-gray-200 rounded bg-gray-50">
              <span className="text-xs text-gray-500">Đến trang</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                className="w-12 text-center border rounded bg-white font-bold text-blue-600 focus:outline-none p-0.5 text-sm"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={handlePageInputBlurOrEnter}
                onKeyDown={handlePageInputBlurOrEnter}
              />
            </div>

            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => prev + 1)} className="px-2 py-1 rounded border border-gray-200 bg-white disabled:opacity-40 text-xs font-medium hover:bg-gray-50">Sau &rsaquo;</button>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} className="px-2 py-1 rounded border border-gray-200 bg-white disabled:opacity-40 text-xs font-medium hover:bg-gray-50">Cuối &raquo;</button>
          </div>
        </div>
      )}

      {/* MODAL XEM CHI TIẾT SÂU HỒ SƠ LOG */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden transform transition-all border border-gray-100 flex flex-col">
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                📂 Chi tiết Nhật ký số: <span className="font-mono text-blue-600">#{selectedLog?.MaLichSu}</span>
              </h3>
              <button onClick={() => { setIsModalOpen(false); setSelectedLog(null); }} className="text-gray-400 hover:text-gray-600 text-xl font-bold focus:outline-none">&times;</button>
            </div>

            {modalLoading ? (
              <div className="p-10 text-center text-sm text-gray-400 animate-pulse">
                ⏳ Đang nạp dữ liệu chi tiết cấu trúc bản ghi...
              </div>
            ) : (
              <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh] text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Hành động</p>
                    {(() => {
                      const actionData = parseAction(selectedLog?.HanhDong);
                      return (
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${actionData.color}`}>
                          {actionData.text}
                        </span>
                      );
                    })()}
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Bảng chịu tác động</p>
                    <p className="font-mono text-gray-800 font-semibold mt-1">{formatTableName(selectedLog?.BangTacDong) || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Địa chỉ IP kết nối</p>
                    <p className="font-mono text-gray-500 mt-1">{selectedLog?.DiaChiIP || "127.0.0.1 (Local)"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Mã bản ghi đích</p>
                    <p className="font-mono text-gray-800 font-semibold mt-1">ID: #{selectedLog?.MaBanGhi || "Chưa phân định"}</p>
                  </div>
                </div>

                <div className="border-l-4 border-blue-500 pl-3 py-1 bg-blue-50/40 rounded-r-lg">
                  <p className="font-semibold text-gray-800">Nhân viên thực hiện: {selectedLog?.TenNhanVien || "Hệ thống tự động"}</p>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    Hộp thư: {selectedLog?.Email || "Không có dữ liệu"} 
                    {selectedLog?.CCCD && ` | CCCD: ${selectedLog.CCCD}`}
                    {` | Thời gian: ${selectedLog?.ThoiGian ? new Date(selectedLog.ThoiGian).toLocaleString("vi-VN") : "—"}`}
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Mô tả hoặc Nội dung mới (NoiDungMoi)</label>
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {selectedLog?.NoiDungMoi || "Không có ghi chú bổ sung."}
                    </div>
                  </div>

                  {selectedLog?.NoiDungCu && (
                    <div>
                      <label className="block text-[11px] font-bold text-red-400 uppercase mb-1">Trạng thái dữ liệu cũ trước khi sửa (NoiDungCu)</label>
                      <div className="bg-red-50/50 border border-red-100 p-3 rounded-lg font-mono text-red-700 whitespace-pre-wrap">
                        {selectedLog?.NoiDungCu}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-3 border-t">
                  <button
                    type="button" onClick={() => { setIsModalOpen(false); setSelectedLog(null); }}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Đóng hộp thoại
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </MainLayout>
  );
}