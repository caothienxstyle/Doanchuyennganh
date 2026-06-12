import { useEffect, useState, useMemo } from "react";
import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { Search, Package, AlertTriangle, Warehouse, ClipboardCheck, FilePlus, Loader2, XCircle, Plus, MapPin } from "lucide-react";
import { getProducts } from "../services/productService";
import { 
  getTonKhoItems, 
  createTonKhoItem, 
  updateTonKhoItem, 
  deleteTonKhoItem 
} from "../services/tonKhoService";

function getInventoryStatus(quantity, minQuantity) {
  if (minQuantity === undefined || minQuantity === null || minQuantity === "" || minQuantity === "—") {
    return "Ổn định";
  }
  const q = Number(quantity) || 0;
  const m = Number(minQuantity);
  return q === 0 ? "Hết hàng" : (q <= m ? "Sắp hết" : "Ổn định");
}

function buildInventoryRows(products = [], tonKhoItems = []) {
  const productMap = new Map();

  products.forEach((product) => {
    const keys = [String(product.id || product.MaSanPham), String(product.code || product.MaSP)]
      .filter((value) => value !== "undefined" && value !== "null" && value !== "");

    keys.forEach((key) => {
      if (!productMap.has(key)) {
        productMap.set(key, product);
      }
    });
  });

  if (!tonKhoItems.length) {
    return products.map((product) => ({
      id: `product-${product.id || product.MaSanPham}`,
      code: product.code || product.MaSP,
      name: product.name || product.TenSanPham,
      quantity: Number(product.quantity || product.SoLuongTon) || 0,
      minQuantity: (product.minQuantity || product.SoLuongToiThieu) ?? "—",
      location: "Chưa cấu hình",
      status: getInventoryStatus(product.quantity || product.SoLuongTon, product.minQuantity),
      rawMaKho: 1,
      rawMaSanPham: product.id || product.MaSanPham,
      rawMaViTriCode: "VT001" 
    }));
  }

  return tonKhoItems.map((item, index) => {
    const raw = item?.data ?? item?.item ?? item?.record ?? item;
    const nested = raw?.tonKho ?? raw?.tonkho ?? raw?.inventory ?? raw?.detail ?? {};
    const resolved = {
      ...(raw && typeof raw === "object" ? raw : {}),
      ...(nested && typeof nested === "object" ? nested : {}),
    };

    const productCode = resolved.MaSP ?? resolved.maSP ?? resolved.code ?? resolved.productCode;
    const productId = resolved.MaSanPham ?? resolved.maSanPham ?? resolved.productId ?? resolved.id;
    const product = productMap.get(String(productId)) || productMap.get(String(productCode));

    const quantity = Number(
      resolved.SoLuongTon ??
        resolved.soLuongTon ??
        resolved.quantity ??
        resolved.stock ??
        0
    );

    const locationStr = resolved.TenViTriHienThi || 
      [resolved.KhuVuc, resolved.DayKe, resolved.Tang, resolved.OKe].filter(Boolean).join(" / ") || 
      `Mã vị trí: ${resolved.MaViTriCode ?? resolved.maViTriCode ?? "—"}`;

    return {
      id: `${productId ?? "unknown"}-${resolved.MaKho ?? "kho"}-${index}`,
      code: product?.code ?? product?.MaSP ?? productCode ?? "—",
      name: product?.name ?? product?.TenSanPham ?? resolved.TenSanPham ?? "Chưa cập nhật",
      quantity: Number.isFinite(quantity) ? quantity : 0,
      minQuantity: product?.minQuantity ?? product?.SoLuongToiThieu ?? "—",
      location: locationStr,
      status: getInventoryStatus(quantity, product?.minQuantity || product?.SoLuongToiThieu),
      rawMaKho: resolved.MaKho ?? 1,
      rawMaSanPham: productId,
      rawMaViTriCode: String(resolved.MaViTriCode ?? resolved.maViTriCode ?? "").trim()
    };
  });
}

export default function InventoryPage() {
  const [inventoryRows, setInventoryRows] = useState([]);
  const [productsList, setProductsList] = useState([]); 
  const [khoList, setKhoList] = useState([]); 
  const [viTriList, setViTriList] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState(""); // 🔍 State lọc nhanh theo trạng thái (KPI)
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [productSearch, setProductSearch] = useState(""); // 🔍 Tìm kiếm SP trong modal
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // 🔢 State phụ phục vụ việc gõ số ô nhập trang
  const [pageInput, setPageInput] = useState("1");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("CREATE"); 
  const [formData, setFormData] = useState({
    MaKho: "",
    MaSanPham: "",
    MaViTriCode: "", 
    SoLuongTon: 0,
  });

  const loadViTriKho = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const response = await fetch("http://localhost:3000/vitrikho/danhsach", { 
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const res = await response.json();
      if (Array.isArray(res)) {
        setViTriList(res);
      } else if (res && res.success) {
        setViTriList(res.data || []);
      }
    } catch (err) {
      console.error("Không thể tải danh sách vị trí kho:", err);
    }
  };

  const loadKhoList = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const response = await fetch("http://localhost:3000/kho/danhsach", {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const res = await response.json();
      if (res.success) setKhoList(res.data || []);
    } catch (err) {
      console.error("Lỗi tải danh sách kho:", err);
    }
  };

  async function loadInventory() {
    try {
      setLoading(true);
      const [productsResult, tonKhoResult] = await Promise.allSettled([getProducts(), getTonKhoItems()]);

      if (productsResult.status !== "fulfilled") {
        throw productsResult.reason;
      }

      setProductsList(productsResult.value || []);

      const rows = buildInventoryRows(
        productsResult.value, 
        tonKhoResult.status === "fulfilled" ? tonKhoResult.value : []
      );
      setInventoryRows(rows);
      setError("");
    } catch (err) {
      const message = err?.response?.data?.message || err?.message;
      setError(message || "Không thể tải dữ liệu tồn kho từ API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
    loadViTriKho();
    loadKhoList();
  }, []);

  // 🚀 Tự động khôi phục bộ lọc trạng thái từ Dashboard (nếu có)
  useEffect(() => {
    const savedFilter = localStorage.getItem('inventoryStatusFilter');
    if (savedFilter) {
      setStatusFilter(savedFilter);
      localStorage.removeItem('inventoryStatusFilter'); // Xóa sau khi dùng để tránh dính lọc cho lần sau
    }
  }, []);

  // Xử lý lọc
  const filteredRows = inventoryRows.filter((row) => {
    const search = (searchTerm || "").toLowerCase().trim();
    const matchesSearch = !search || (
      row.code.toLowerCase().includes(search) || 
      row.name.toLowerCase().includes(search) ||
      row.location.toLowerCase().includes(search) ||
      (khoList.find(k => String(k.MaKho) === String(row.rawMaKho))?.TenKho || "").toLowerCase().includes(search)
    );

    const matchesStatus = !statusFilter || (
      statusFilter === "DANGER" 
        ? (row.status === "Sắp hết" || row.status === "Hết hàng")
        : row.status === statusFilter
    );

    return matchesSearch && matchesStatus;
  });

  // 🚀 Lọc danh sách sản phẩm trong Modal để người dùng chọn nhanh hơn
  const filteredProductsForModal = useMemo(() => {
    if (!productSearch.trim()) return productsList;
    const s = productSearch.toLowerCase();
    return productsList.filter(p => 
      String(p.name || p.TenSanPham || "").toLowerCase().includes(s) ||
      String(p.code || p.MaSP || "").toLowerCase().includes(s)
    );
  }, [productsList, productSearch]);

  // Tính toán phân trang
  const totalItems = filteredRows.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPaginatedRows = filteredRows.slice(indexOfFirstItem, indexOfLastItem);

  // Đồng bộ ô nhập số trang khi currentPage thay đổi (do bấm nút Trước/Sau)
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Reset trang về 1 mỗi khi đổi từ khóa tìm kiếm hoặc đổi số dòng/trang
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, statusFilter]);

  // 🔥 HÀM XỬ LÝ KHI NGƯỜI DÙNG TỰ GÕ SỐ TRANG
  const handlePageInputChange = (e) => {
    setPageInput(e.target.value);
  };

  const handlePageInputBlurOrEnter = (e) => {
    if (e.key && e.key !== "Enter") return; // Nếu gõ phím nhưng không phải Enter thì bỏ qua

    let targetPage = parseInt(pageInput, 10);
    
    // Nếu gõ bậy bạ không phải số, đưa về trang hiện tại
    if (isNaN(targetPage)) {
      setPageInput(String(currentPage));
      return;
    }

    // Ràng buộc số trang nằm trong khoảng hợp lệ [1 -> totalPages]
    if (targetPage < 1) targetPage = 1;
    if (targetPage > totalPages) targetPage = totalPages;

    setCurrentPage(targetPage);
    setPageInput(String(targetPage));
  };

  const handleOpenCreate = () => {
    setModalMode("CREATE");
    setProductSearch(""); // Reset ô tìm kiếm khi mở modal tạo mới
    setFormData({ 
      MaKho: khoList.length > 0 ? String(khoList[0].MaKho) : "", 
      MaSanPham: "", 
      MaViTriCode: "", 
      SoLuongTon: "" 
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row) => {
    setModalMode("UPDATE");
    
    // 🌟 Tìm thông tin sản phẩm từ danh sách để hiển thị Mã Sp thay vì ID hệ thống
    const product = productsList.find(p => 
      String(p.id || p.MaSanPham || p.masanpham) === String(row.rawMaSanPham)
    );
    const displayString = product 
      ? `[${product.code || product.MaSP}] - ${product.name || product.TenSanPham}` 
      : `Sản phẩm #${row.rawMaSanPham}`;

    setFormData({
      MaKho: Number(row.rawMaKho),
      MaSanPham: Number(row.rawMaSanPham),
      MaViTriCode: String(row.rawMaViTriCode), 
      SoLuongTon: row.quantity,
      ProductDisplay: displayString // Dùng để hiển thị thông tin rõ ràng hơn trong Modal
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    try {
      let res;
      const payload = {
        MaKho: Number(formData.MaKho),
        MaSanPham: Number(formData.MaSanPham),
        MaViTriCode: String(formData.MaViTriCode).trim(), 
        SoLuongTon: Number(formData.SoLuongTon)
      };

      if (modalMode === "CREATE") {
        res = await createTonKhoItem(payload);
      } else {
        res = await updateTonKhoItem(payload);
      }

      if (res && (res.success || res.message?.includes("thành công") || res.data)) {
        alert(res.message || "Thao tác tồn kho hoàn tất!");
        setIsModalOpen(false);
        await loadInventory(); 
      } else {
        alert(`Thất bại: ${res?.message || "Vui lòng kiểm tra lại dữ liệu"}`);
      }
    } catch (err) {
      const backendMessage = err?.response?.data?.message || err?.message || "Lỗi không xác định";
      alert(`Lỗi hệ thống Backend trả về:\n👉 ${backendMessage}`);
    }
  };

  const handleDeleteClick = async (row) => {
    const confirmMsg = `Bạn có chắc chắn muốn xóa vị trí tồn kho của mặt hàng này?\n- Mã SP: ${row.code}\n- Mã kho: ${row.rawMaKho}\n- Mã Vị trí: ${row.rawMaViTriCode}`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await deleteTonKhoItem({
        MaKho: Number(row.rawMaKho),
        MaSanPham: Number(row.rawMaSanPham),
        MaViTriCode: String(row.rawMaViTriCode).trim() 
      });

      if (res && (res.success || res.message?.includes("thành công") || res.data)) {
        alert(res.message || "Xóa bản ghi tồn kho thành công!");
        await loadInventory();
      } else {
        alert(`Không thể xóa: ${res?.message || "Lỗi không xác định"}`);
      }
    } catch (err) {
      const backendMessage = err?.response?.data?.message || err?.message;
      alert(`Lỗi hệ thống khi xóa: ${backendMessage}`);
    }
  };

  return (
    <MainLayout>
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Quản lý Tồn kho Chi tiết</h2>
          <p className="text-sm text-gray-400 mt-1">Theo dõi số lượng tồn kho thực tế theo sản phẩm và sơ đồ vị trí kệ</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-white text-sm hover:bg-blue-700 font-bold transition-all shadow-md flex items-center gap-2"
        >
          <FilePlus size={18}/> + Cấu hình tồn kho mới
        </button>
      </div>

      {/* KPI STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div 
          onClick={() => setStatusFilter("")}
          className={`cursor-pointer transition-all hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${statusFilter === "" ? "border-blue-500 ring-2 ring-blue-500/10" : "border-gray-100"}`}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Warehouse size={20}/>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tất cả hàng hóa</p>
            <h3 className="text-xl font-bold text-gray-800">{inventoryRows.length} <span className="text-xs font-normal text-gray-400">Bản ghi</span></h3>
          </div>
        </div>
        <div 
          onClick={() => setStatusFilter("Sắp hết")}
          className={`cursor-pointer transition-all hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${statusFilter === "Sắp hết" ? "border-amber-500 ring-2 ring-amber-500/10" : "border-gray-100"}`}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertTriangle size={20}/>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sản phẩm sắp hết</p>
            <h3 className="text-xl font-bold text-amber-600">{inventoryRows.filter(r => r.status === "Sắp hết").length} <span className="text-xs font-normal text-gray-400">Cần nhập</span></h3>
          </div>
        </div>
        <div 
          onClick={() => setStatusFilter("Hết hàng")}
          className={`cursor-pointer transition-all hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${statusFilter === "Hết hàng" ? "border-red-600 ring-2 ring-red-600/10" : "border-gray-100"}`}
        >
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <XCircle size={20}/>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Đã hết hàng</p>
            <h3 className="text-xl font-bold text-red-600">{inventoryRows.filter(r => r.status === "Hết hàng").length} <span className="text-xs font-normal text-black-400">Hết sạch</span></h3>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 relative">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tìm kiếm thông minh</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
              <input
                type="text"
                placeholder="Tìm theo mã sản phẩm, tên hàng hóa, vị trí lưu trữ..."
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

      {loading && <div className="flex items-center justify-center p-12 text-gray-400 animate-pulse">⏳ Đang truy xuất dữ liệu tồn kho...</div>}
      {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 mb-6 text-sm">⚠️ {error}</div>}

      {/* BẢNG DỮ LIỆU */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <DataTable
            columns={[
              { 
                key: "code", 
                label: "Mã SP", 
                render: (v) => <span className="font-mono font-bold text-indigo-600 text-xs">{v}</span> 
              },
              { key: "name", label: "Tên sản phẩm", render: (v) => <span className="font-semibold text-gray-800">{v}</span> },
              { key: "quantity", label: "Số lượng tồn", render: (val) => <span className="font-semibold text-gray-800">{val}</span> },
              { key: "minQuantity", label: "Tối thiểu", render: (v) => <span className="text-gray-400 font-mono text-xs">{v}</span> },
                            { 
                key: "warehouse", 
                label: "Kho lưu trữ", 
                render: (_, row) => {
                  const kho = khoList.find(k => String(k.MaKho) === String(row.rawMaKho));
                  return (
                    <div className="flex items-center gap-1.5 font-bold text-gray-700 text-[11px] uppercase whitespace-nowrap">
                      <Warehouse size={12} className="text-blue-500"/>
                      {kho ? kho.TenKho : `Kho #${row.rawMaKho}`}
                    </div>
                  );
                }
              },
              { 
                key: "location", 
                label: "Vị trí kho", 
                render: (val) => (
                  <div className="flex items-center gap-1.5 font-medium text-blue-600 font-mono bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 w-fit">
                    <MapPin size={12} className="text-indigo-400"/> {val}
                  </div>
                ) 
              },
             { 
  key: "status", 
  label: "Trạng thái", 
  render: (value) => {
    if (value === "Hết hàng") {
      return (
        <span className=" rounded-full px-2.5 py-1  text-xs font-medium bg-red-50 text-red-600 border border-red-100 whitespace-nowrap">
          Hết hàng
        </span>
      );
    }
    if (value === "Sắp hết") {
      return (
        <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-600 border border-amber-100">
          Sắp hết
        </span>
      );
    }
    // Mặc định là trạng thái "Ổn định"
    return (
      <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-green-50 text-green-600 border border-green-100">
        {value || "Ổn định"}
      </span>
    );
  }
},
              
              {
                key: "actions",
                label: "Hành động",
                render: (_, row) => (
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleOpenEdit(row)}
                      className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 px-2 py-1 rounded"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDeleteClick(row)}
                      className="text-red-600 hover:text-red-800 font-medium text-sm bg-red-50 px-2 py-1 rounded"
                    >
                      Xóa
                    </button>
                  </div>
                ),
              },
            ]}
            data={currentPaginatedRows}
          />
          {filteredRows.length === 0 && (
            <div className="p-12 text-center text-gray-400 text-sm italic">📭 Không tìm thấy dữ liệu tồn kho phù hợp với từ khóa này.</div>
          )}
        </div>
      )}

      {/* PAGINATION NAVIGATION */}
      {!loading && !error && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-500">
          <div>
            Hiển thị <span className="font-bold text-gray-800">{totalItems === 0 ? 0 : indexOfFirstItem + 1}</span> -{" "}
            <span className="font-bold text-gray-800">{Math.min(indexOfLastItem, totalItems)}</span> trên{" "}
            <span className="font-bold text-gray-800">{totalItems}</span> hồ sơ
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
                onChange={handlePageInputChange} 
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

      {/* MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">
                {modalMode === "CREATE" ? "Tạo Vị Trí Tồn Kho Mới" : "Cập Nhật Số Lượng Tồn Kho"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 text-xl font-semibold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kho nhận hàng</label>
                <select
                  required
                  className="w-full border rounded-lg p-2 text-sm bg-white disabled:bg-gray-100 font-bold text-gray-700"
                  value={formData.MaKho}
                  onChange={(e) => setFormData({ ...formData, MaKho: e.target.value, MaViTriCode: "" })}
                >
                  <option value="">-- Chọn kho lưu trữ --</option>
                  {khoList.map((kho) => (
                    <option key={kho.MaKho} value={kho.MaKho}>
                      {kho.TenKho} {kho.DiaChi ? `(${kho.DiaChi})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sản phẩm</label>
                {modalMode === "CREATE" ? (
                  <div className="space-y-3">
                    {!formData.MaSanPham ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input 
                            type="text"
                            autoFocus
                            placeholder="Gõ tên hoặc mã sản phẩm để tìm nhanh..."
                            className="w-full pl-8 pr-3 py-2.5 border rounded-xl text-sm outline-none focus:border-blue-500 bg-white shadow-sm transition-all"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                          />
                        </div>
                        
                        <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-xl bg-gray-50/50 divide-y divide-gray-100 scrollbar-thin shadow-inner">
                          {filteredProductsForModal.length > 0 ? (
                            filteredProductsForModal.slice(0, 50).map((p) => (
                              <div 
                                key={p.id || p.MaSanPham}
                                onClick={() => {
                                  setFormData({ ...formData, MaSanPham: p.id || p.MaSanPham });
                                  setProductSearch("");
                                }}
                                className="p-3 hover:bg-blue-50 cursor-pointer transition-all flex items-center justify-between group"
                              >
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-gray-700 group-hover:text-blue-700">{p.name || p.TenSanPham}</span>
                                  <span className="text-[10px] text-gray-400 font-mono mt-0.5">Mã SP: {p.code || p.MaSP}</span>
                                </div>
                                <Plus size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                              </div>
                            ))
                          ) : (
                            <div className="p-4 text-center text-xs text-gray-400 italic">Không tìm thấy sản phẩm này...</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 border-2 border-blue-100 bg-blue-50/50 rounded-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
                            <Package size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-blue-900">
                              {productsList.find(p => String(p.id || p.MaSanPham) === String(formData.MaSanPham))?.name || "Sản phẩm đã chọn"}
                            </p>
                            <p className="text-[10px] font-bold text-blue-500 font-mono uppercase">
                              Mã SP: {productsList.find(p => String(p.id || p.MaSanPham) === String(formData.MaSanPham))?.code || "---"}
                            </p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, MaSanPham: "" })}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    disabled
                    className="w-full border rounded-lg p-2 text-sm bg-gray-100 font-bold text-gray-700"
                    value={formData.ProductDisplay || `Sản phẩm ID: ${formData.MaSanPham}`}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vị Trí Lưu Trữ Hàng Hóa
                </label>
                {(() => {
                    // 🛡️ Tự động lọc vị trí kho dựa trên Kho đang được chọn (áp dụng cho cả Thêm và Sửa)
                    const filteredViTri = viTriList.filter(vt => String(vt.MaKho) === String(formData.MaKho));
                    
                    return filteredViTri.length > 0 ? (
                    <select
                      required
                      className="w-full border rounded-lg p-2 text-sm bg-white font-mono font-bold text-blue-600"
                      value={formData.MaViTriCode}
                      onChange={(e) => setFormData({ ...formData, MaViTriCode: e.target.value })}
                    >
                      <option value="">-- Chọn vị trí kệ --</option>
                      {filteredViTri.map((vt) => (
                        <option key={vt.MaViTriCode} value={vt.MaViTriCode}>
                          {vt.TenViTriHienThi || `Mã: ${vt.MaViTriCode}`} {vt.GhiChu ? `(${vt.GhiChu})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: VT001, VT002..."
                      className="w-full border rounded-lg p-2 text-sm bg-white font-mono font-bold"
                      value={formData.MaViTriCode}
                      onChange={(e) => setFormData({ ...formData, MaViTriCode: e.target.value })}
                    />
                    );
                  })()}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng tồn kho hiện tại</label>
                <input
                  min="0"
                  required
                 
                  className="w-full border rounded-lg p-2 text-sm font-bold text-blue-600"
                  value={formData.SoLuongTon}
                  onChange={(e) => setFormData({ ...formData, SoLuongTon: e.target.value })}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  {modalMode === "CREATE" ? "Xác nhận tạo" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}