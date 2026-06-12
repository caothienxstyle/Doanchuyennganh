import { useState, useEffect } from "react";
import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable"; // Import DataTable
import StatusBadge from "../components/StatusBadge";
import { Search, Package, AlertTriangle, CheckCircle2, FilePlus, Layers, Loader2 } from "lucide-react";
import { getCurrentRole, ROLES } from "../services/auth";
import { deleteProduct, createProduct, updateProduct } from "../services/productService";
import axios from "axios"; 

const SERVER_URL = "http://localhost:3000";

const EMPTY_FORM = {
  maSp: "",
  barcode: "",
  qrcode: "",
  name: "",
  categoryName: "",   // Lưu ID số danh mục hoặc '__NEW__'
  unitName: "",       // Lưu ID số đơn vị tính hoặc '__NEW__'
  description: "",
  image: "",
  minQuantity: "",
  soLuongTon: "", 
};

// Hàm sắp xếp sản phẩm theo Mã tăng dần
function sortProductsByCode(products = []) {
  return [...products].sort((a, b) => {
    const codeA = String(a.code || a.MaSP || "").toLowerCase();
    const codeB = String(b.code || b.MaSP || "").toLowerCase();
    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" });
  });
}

export default function ProductPage() {
  const role = getCurrentRole();
  const isAdmin = role === ROLES.admin || String(role) === "1" || role === "Admin";
  const isManager = role === ROLES.manager || String(role) === "2" || role === "Quản lý kho";
  const isViewer = role === ROLES.staff || String(role) === "3" || role === "Nhân viên kho";
  const canManageProducts = isAdmin || isManager || isViewer;
  const canDeleteProducts = isAdmin || isManager;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null); // New state for file object

  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);

  // Các state hỗ trợ thêm mới danh mục / đơn vị tính trực tiếp
  const [customCategory, setCustomCategory] = useState("");
  const [customUnit, setCustomUnit] = useState("");

  // 🔍 STATE TÌM KIẾM
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter,  setStockFilter] = useState("all"); // 🔍 Trạng thái lọc theo KPI (all | lowStock)

  // 📄 STATE PHÂN TRANG
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState("1");
  const [goToPageInput, setGoToPageInput] = useState("");
  const [zoomedImage, setZoomedImage] = useState(null);

  const getToken = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";

  // Hàm fetch danh mục và đơn vị tính từ API
  const fetchSelectData = async () => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };

      const [resDm, resDv] = await Promise.all([
        axios.get("http://localhost:3000/danhmuc/danhsach", { headers }).catch(() => ({ data: { data: [] } })), 
        axios.get("http://localhost:3000/donvitinh/danhsachdonvitinh", { headers }).catch(() => ({ data: { data: [] } }))
      ]);

      if (resDm.data?.success) setCategories(resDm.data.data);
      if (resDv.data?.success) setUnits(resDv.data.data);
    } catch (error) {
      console.error("Không thể tải danh mục hoặc đơn vị tính:", error);
    }
  };

  useEffect(() => {
    fetchSelectData();
  }, []);

  // Tự động đưa về trang 1 khi thay đổi bộ lọc hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, stockFilter, itemsPerPage]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setCustomCategory("");
    setCustomUnit("");
    setEditingProduct(null);
    setModalOpen(false);
  };

  const openCreateModal = () => {
    setEditingProduct(null); // Reset editingProduct
    setForm(EMPTY_FORM);
    setFormError("");
    setCustomCategory("");
    setCustomUnit("");
    setActionMessage("");
    setSelectedImageFile(null); // Reset new state
    setModalOpen(true);
    setForm(prev => ({ ...prev, maSp: `SP${Date.now().toString().slice(-6)}` })); // Auto-generate maSp
  };

  // ✅ ĐÃ FIX: Đồng bộ chính xác sang key viết thường của Service Layer dữ liệu đổ vào form không bị rỗng
  const openEditModal = (product) => {
    setEditingProduct(product);
    setForm({
      maSp: product.code || product.MaSP || "",
      barcode: product.barcode || product.Barcode || "",
      qrcode: product.qrCode || product.QRCode || "",
      name: product.name || product.TenSanPham || "",
      categoryName: product.categoryId || product.MaDanhMuc || "", 
      unitName: product.unitId || product.MaDonVi || "",      
      description: product.description || product.MoTa || "",
      image: product.image || product.AnhSanPham || "",
      minQuantity: product.minQuantity ?? product.SoLuongToiThieu ?? 0,
      soLuongTon: product.SoLuongTon ?? product.quantity ?? 0,
    });
    setFormError("");
    setCustomCategory("");
    setCustomUnit("");
    setActionMessage("");
    setSelectedImageFile(null); // Reset new state
    setModalOpen(true);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  // Xử lý chọn file ảnh từ máy tính
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImageFile(file);
    }
  };

  // Hàm mở modal xem ảnh lớn
  const handleZoomImage = (imgSrc) => {
    if (!imgSrc) return;
    const fullUrl = String(imgSrc).startsWith('http') ? imgSrc : `${SERVER_URL}${imgSrc}`;
    setZoomedImage(fullUrl);
  };

  // Xử lý gửi Form (Thêm / Sửa sản phẩm)
  const handleSubmit = async (event, refreshProducts, products) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError("");

    if (!form.maSp.trim()) {
      setFormError("Vui lòng nhập Mã sản phẩm (Trường bắt buộc).");
      return;
    }
    if (!form.name.trim()) {
      setFormError("Vui lòng nhập tên sản phẩm.");
      return;
    }
    if (!form.categoryName) {
      setFormError("Vui lòng chọn hoặc thêm mới danh mục.");
      return;
    }
    if (form.categoryName === "__NEW__" && !customCategory.trim()) {
      setFormError("Vui lòng gõ tên danh mục mới.");
      return;
    }
    if (!form.unitName) {
      setFormError("Vui lòng chọn hoặc thêm mới đơn vị tính.");
      return;
    }
    if (form.unitName === "__NEW__" && !customUnit.trim()) {
      setFormError("Vui lòng gõ tên đơn vị tính mới.");
      return;
    }

    // Validate duplicate product name
    const newName = form.name.trim();
    const isDuplicateName = (products || []).some(p => {
      const existingName = (p.name || p.TenSanPham || "").toLowerCase();
      return existingName === newName.toLowerCase() && (editingProduct ? p.id !== editingProduct.id : true);
    });

    if (isDuplicateName) {
      setFormError("Tên sản phẩm đã tồn tại. Vui lòng chọn tên khác.");
      setIsSubmitting(false);
      return;
    }

    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };

      let finalCategoryId = form.categoryName;
      let finalUnitId = form.unitName;

      // 1. Nếu chọn thêm mới Danh mục trực tiếp từ dropdown
      if (form.categoryName === "__NEW__") {
        const resCat = await axios.post("http://localhost:3000/danhmuc/them", {
          TenDanhMuc: customCategory.trim()
        }, { headers });
        if (resCat.data?.success) {
          finalCategoryId = resCat.data.data.id || resCat.data.data.MaDanhMuc;
        } else {
          throw new Error("Không thể tạo danh mục mới.");
        }
      }

      // 2. Nếu chọn thêm mới Đơn vị tính trực tiếp từ dropdown
      if (form.unitName === "__NEW__") {
        const resUni = await axios.post("http://localhost:3000/donvitinh/them", {
          TenDonVi: customUnit.trim()
        }, { headers });
        if (resUni.data?.success) {
          finalUnitId = resUni.data.data.id || resUni.data.data.MaDonVi;
        } else {
          throw new Error("Không thể tạo đơn vị tính mới.");
        }
      }

      // SỬ DỤNG FormData ĐỂ GỬI FILE VÀ DỮ LIỆU
      const formData = new FormData();
      formData.append("MaSP", form.maSp.trim());
      formData.append("Barcode", form.barcode.trim() || "");
      formData.append("QRCode", form.qrcode.trim() || "");
      formData.append("TenSanPham", form.name.trim());
      formData.append("MaDanhMuc", finalCategoryId);
      formData.append("MaDonVi", finalUnitId);
      formData.append("MoTa", form.description.trim() || "");
      formData.append("SoLuongToiThieu", form.minQuantity || 0);

      // ĐỔI THÀNH "AnhSanPham" ĐỂ KHỚP VỚI MULTER BACKEND
      if (selectedImageFile) {
        formData.append("AnhSanPham", selectedImageFile);
      }

      if (editingProduct) {
        await updateProduct(formData);
        setActionMessage("Cập nhật thông tin sản phẩm thành công.");
      } else {
        formData.append("SoLuongTon", form.soLuongTon || 0);
        await createProduct(formData);
        setActionMessage("Thêm sản phẩm mới và tự động khởi tạo tồn kho thành công!");
      }

      await fetchSelectData(); 
      await refreshProducts();
      resetForm();
    } catch (err) {
      // 🛡️ Xử lý thông báo thân thiện cho nhân viên khi chức năng bị gỡ bỏ (Lỗi 500/403)
      const status = err?.response?.status;
      if (status === 500 || status === 403) {
        setFormError("Tài khoản của bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ Quản trị viên để biết thêm chi tiết.");
      } else {
        setFormError(err?.response?.data?.message || err?.message || "Không thể lưu sản phẩm.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

//Xoas sản phẩm - Xác nhận kỹ càng vì sẽ xóa cả dữ liệu tồn kho liên quan
  const handleDelete = async (product, refreshProducts) => {
    const targetCode = product.code || product.MaSP;
    const targetName = product.name || product.TenSanPham || targetCode;
    
    if (!window.confirm(`Bạn có chắc muốn xóa hoàn toàn sản phẩm: "${targetName}"?\nHành động này sẽ xóa cả dữ liệu trong bảng Tồn Kho.`)) return;

    try {
      setIsSubmitting(true);
      
      await deleteProduct(targetCode); 
      
      await refreshProducts();
      setActionMessage("Xóa sản phẩm thành công.");
    } catch (err) {
      setFormError(err?.response?.data?.message || err?.message || "Không thể xóa sản phẩm.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý nhảy trang từ ô nhập số nhanh
  const handleGoToPageSubmit = (e, totalPages) => {
    e.preventDefault();
    const pageNum = parseInt(goToPageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setPageInput(String(pageNum));
    } else {
      alert(`Vui lòng nhập số trang hợp lệ từ 1 đến ${totalPages}`);
    }
    setGoToPageInput("");
  };

  // Hàm xác định trạng thái tồn kho (Đồng bộ với InventoryPage)
  const getStockStatus = (quantity, minQuantity) => {
    const q = Number(quantity) || 0;
    const m = Number(minQuantity);
    if (isNaN(m)) return "Ổn định";
    if (q === 0) return "Hết hàng";
    return q <= m ? "Sắp hết" : "Ổn định";
  };

  return (
    <MainLayout role={role}>
      {({ products, loading, error, refreshProducts }) => {
        
        // 1. Lọc theo từ khóa tìm kiếm trước để tính toán KPI chính xác
        const searchFiltered = (products || []).filter((product) => {
          const sTerm = searchTerm.toLowerCase();
          const maSp = String(product.code || product.MaSP || "").toLowerCase();
          const tenSp = String(product.name || product.TenSanPham || "").toLowerCase();
          const tenDm = String(product.category || product.TenDanhMuc || "").toLowerCase();
          const tenDvt = String(product.unit || product.TenDonVi || "").toLowerCase();

          const isMatch = maSp.includes(sTerm) || tenSp.includes(sTerm) || tenDm.includes(sTerm) || tenDvt.includes(sTerm);
          
          if (isMatch) {
            // Gắn trạng thái vào object để dùng trong bảng và lọc KPI
            product.status = getStockStatus(
              product.SoLuongTon ?? product.quantity ?? 0,
              product.minQuantity ?? product.SoLuongToiThieu ?? 0
            );
          }
          return isMatch;
        });

        // 2. Tính toán thống kê KPI
        const lowStockCount = searchFiltered.filter(p => p.status === "Sắp hết").length;
        const outOfStockCount = searchFiltered.filter(p => p.status === "Hết hàng").length;

        // 3. Áp dụng lọc nhanh từ các thẻ KPI vào danh sách hiển thị
        const finalFiltered = searchFiltered.filter(p => {
          if (stockFilter === "lowStock") return p.status === "Sắp hết";
          if (stockFilter === "outOfStock") return p.status === "Hết hàng";
          const stock = p.SoLuongTon ?? p.quantity ?? 0;
          return true;
        });

        // Sắp xếp và phân trang từ kết quả đã lọc cuối cùng
        const sortedProducts = sortProductsByCode(finalFiltered);
        const totalItems = sortedProducts.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        const activePage = currentPage > totalPages ? totalPages : currentPage;
        
        const startIndex = (activePage - 1) * itemsPerPage;
        const paginatedProducts = sortedProducts.slice(startIndex, startIndex + itemsPerPage);

        // Khai báo cột hiển thị - Sử dụng triệt để data đã qua xử lý từ Service
        const tableColumns = [
          { 
            key: "code", 
            label: "Mã sản phẩm", 
            render: (val, row) => (
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 cursor-zoom-in hover:opacity-80 transition-all"
                  onClick={() => handleZoomImage(row.AnhSanPham || row.image)}
                >
                  {row.AnhSanPham || row.image ? (
                    <img 
                      src={String(row.AnhSanPham || row.image).startsWith('http') ? (row.AnhSanPham || row.image) : `${SERVER_URL}${row.AnhSanPham || row.image}`} 
                      alt="sp" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <Package size={14} className="text-gray-400" />
                  )}
                </div>
                <span className="font-mono font-bold text-indigo-600 text-xs">{row.code || row.MaSP || val}</span>
              </div>
            )
          },
          { key: "name", label: "Tên sản phẩm", render: (val, row) => <span className="font-semibold text-gray-800">{row.name || row.TenSanPham || val}</span> },
          { key: "category", label: "Danh mục", render: (val, row) => row.category || row.TenDanhMuc || val || "Chưa phân loại" },
          { key: "unit", label: "Đơn vị", render: (val, row) => <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{row.unit || row.TenDonVi || val || "---"}</span> },
          { 
            key: "quantity", 
            label: "Tồn kho", 
            render: (val, row) => {
              const stock = row.SoLuongTon ?? row.quantity ?? val;
              const min = row.minQuantity ?? row.SoLuongToiThieu ?? 0;
              const isLow = stock <= min;
              return (
                <span className={`font-bold ${isLow ? "text-red-600 bg-red-50 px-2 py-1 rounded" : "text-gray-700"}`}>
                  {stock !== undefined && stock !== null ? stock : 0}
                </span>
              );
            } 
          },
          { 
            key: "status", 
            label: "Trạng thái", 
            render: (value) => {
              if (value === "Hết hàng") {
                return (
                  <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-red-50 text-red-600 border border-red-100">
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(row)}
                  className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  Sửa
                </button>
                {canDeleteProducts && (
                  <button
                    type="button"
                    onClick={() => handleDelete(row, refreshProducts)}
                    className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    Xóa
                  </button>
                )}
              </div>
            ),
          },
        ];

        return (
          <>
            {/* HEADER SECTION */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Quản lý Kho Sản phẩm</h2>
                <p className="text-sm text-gray-400 mt-1">Danh mục hồ sơ hàng hóa và theo dõi định mức tồn kho an toàn</p>
              </div>
              {canManageProducts && (
                <button type="button" onClick={openCreateModal} className="rounded-xl bg-blue-600 px-5 py-2.5 text-white text-sm hover:bg-blue-700 font-bold transition-all shadow-md flex items-center gap-2">
                  <FilePlus size={18}/> + Thêm sản phẩm mới
                </button>
              )}
            </div>

            {/* KPI STATS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div 
                onClick={() => setStockFilter("all")}
                className={`cursor-pointer transition-all hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${stockFilter === "all" ? "border-blue-500 ring-2 ring-blue-500/10" : "border-gray-100"}`}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Package size={20}/></div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tất cả hàng hóa</p>
                  <h3 className="text-xl font-bold text-gray-800">{searchFiltered.length} <span className="text-xs font-normal text-gray-400">Mã</span></h3>
                </div>
              </div>
              <div 
                onClick={() => setStockFilter("lowStock")}
                className={`cursor-pointer transition-all hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${stockFilter === "lowStock" ? "border-red-500 ring-2 ring-red-500/10" : "border-gray-100"}`}
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600"><AlertTriangle size={20}/></div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sắp hết hàng</p>
                  <h3 className="text-xl font-bold text-orange-600">{lowStockCount} <span className="text-xs font-normal text-gray-400">Cảnh báo</span></h3>
                </div>
              </div>
              <div
                onClick={() => setStockFilter("outOfStock")}
                className={`cursor-pointer transition-all hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${stockFilter === "outOfStock" ? "border-red-600 ring-2 ring-red-600/10" : "border-gray-100"}`}
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                  <AlertTriangle size={20}/>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Đã hết sạch hàng</p>
                  <h3 className="text-xl font-bold text-red-600">{outOfStockCount} <span className="text-xs font-normal text-gray-400">Mã</span></h3>
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
                      placeholder="Tìm theo Tên, Mã hàng, Danh mục, Đơn vị tính..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                      value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Hiển thị</label>
                  <select 
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  >
                    <option value={10}>10 sản phẩm / trang</option>
                    <option value={20}>20 sản phẩm / trang</option>
                    <option value={50}>50 sản phẩm / trang</option>
                  </select>
                </div>
              </div>
            </div>

            {actionMessage && <p className="mb-4 text-sm text-green-600 bg-green-50 p-3 rounded-xl border border-green-100 font-medium">✨ {actionMessage}</p>}
            {loading && <div className="flex items-center justify-center p-12 text-gray-400 animate-pulse">⏳ Đang đồng bộ danh mục hàng hóa...</div>}
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 mb-6 text-sm">⚠️ {error}</div>}

            {/* BẢNG DỮ LIỆU */}
            {!loading && !error && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <DataTable columns={tableColumns} data={paginatedProducts} />
                {finalFiltered.length === 0 && (
                  <div className="p-12 text-center text-gray-400 text-sm italic">📭 Không tìm thấy sản phẩm nào phù hợp với từ khóa.</div>
                )}
              </div>
            )}

            {/* PAGINATION NAVIGATION */}
            {!loading && !error && totalItems > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-500">
                <div>
                  Hiển thị từ <span className="font-bold text-gray-800">{totalItems === 0 ? 0 : startIndex + 1}</span> đến{" "}
                  <span className="font-bold text-gray-800">{Math.min(startIndex + itemsPerPage, totalItems)}</span> trên tổng số{" "}
                  <span className="font-bold text-gray-800">{totalItems}</span> hồ sơ
                </div>

                <div className="flex items-center space-x-2">
                  <button disabled={activePage === 1} onClick={() => setCurrentPage(1)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all font-medium text-xs">« Đầu</button>
                  <button disabled={activePage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all font-medium text-xs">‹ Trước</button>
                  
                  <div className="flex items-center space-x-1.5 px-3 py-1 border border-gray-200 rounded-lg bg-gray-50/50">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Trang</span>
                    <input 
                      type="number"
                      className="w-10 text-center bg-transparent font-bold text-blue-600 focus:outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                      value={activePage} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val);
                      }}
                    />
                    <span className="text-[10px] font-bold text-gray-400 uppercase">/ {totalPages}</span>
                  </div>

                  <button disabled={activePage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all font-medium text-xs">Sau ›</button>
                  <button disabled={activePage === totalPages} onClick={() => setCurrentPage(totalPages)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all font-medium text-xs">Cuối »</button>
                </div>
              </div>
            )}

            {/* FORM MODAL THÊM / SỬA SẢN PHẨM */}
            {modalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 max-h-screen overflow-y-auto">
                <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl my-8">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold">{editingProduct ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}</h3>
                    <button type="button" onClick={resetForm} className="rounded-full border border-gray-200 px-3 py-1 text-gray-500 hover:bg-gray-100">✕</button>
                  </div>

                  {formError && <p className="mb-4 text-sm text-red-500 font-semibold">⚠️ {formError}</p>}

                  <form onSubmit={(e) => handleSubmit(e, refreshProducts, products)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Mã SP */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mã Sản Phẩm (*)</label>
                        <input
                          type="text"
                          name="maSp"
                          disabled={!!editingProduct || !canManageProducts} // Disable maSp for new products and if not manager/admin
                          className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-gray-100"
                          placeholder="Ví dụ: SP001"
                          value={form.maSp}
                          onChange={handleInputChange}
                        />
                      </div>

                      {/* Tên SP */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên Sản Phẩm (*)</label>
                        <input
                          type="text"
                          name="name"
                          className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500"
                          value={form.name}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Dropdown Danh Mục */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
                        <select
                          name="categoryName"
                          className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500"
                          value={form.categoryName}
                          onChange={handleInputChange}
                        >
                          <option value="">-- Chọn danh mục --</option>
                          {categories.map((cat) => (
                            <option key={cat.MaDanhMuc} value={cat.MaDanhMuc}>{cat.TenDanhMuc}</option>
                          ))}
                          <option value="__NEW__">+ Thêm danh mục mới...</option>
                        </select>
                        {form.categoryName === "__NEW__" && (
                          <input
                            type="text"
                            placeholder="Nhập tên danh mục mới"
                            className="mt-2 w-full rounded-xl border border-blue-400 p-2 text-sm outline-none"
                            value={customCategory}
                            onChange={(e) => setCustomCategory(e.target.value)}
                          />
                        )}
                      </div>

                      {/* Dropdown Đơn vị tính */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị tính</label>
                        <select
                          name="unitName"
                          className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500"
                          value={form.unitName}
                          onChange={handleInputChange}
                        >
                          <option value="">-- Chọn đơn vị --</option>
                          {units.map((u) => (
                            <option key={u.MaDonVi} value={u.MaDonVi}>{u.TenDonVi}</option>
                          ))}
                          <option value="__NEW__">+ Thêm đơn vị mới...</option>
                        </select>
                        {form.unitName === "__NEW__" && (
                          <input
                            type="text"
                            placeholder="Nhập tên đơn vị tính mới"
                            className="mt-2 w-full rounded-xl border border-blue-400 p-2 text-sm outline-none"
                            value={customUnit}
                            onChange={(e) => setCustomUnit(e.target.value)}
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Barcode */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mã Barcode</label>
                        <input
                          type="text"
                          name="barcode"
                          className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500"
                          value={form.barcode}
                          onChange={handleInputChange}
                        />
                      </div>
                      {/* QRCode */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mã QRCode</label>
                        <input
                          type="text"
                          name="qrcode"
                          className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500"
                          value={form.qrcode}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Số lượng tối thiểu */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng tối thiểu</label>
                        <input
                          type="number"
                          name="minQuantity"
                          className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={form.minQuantity}
                          onChange={handleInputChange}
                        />
                      </div>

                      {/* Số lượng tồn đầu kì - CHỈ HIỆN KHI THÊM MỚI */}
                      {!editingProduct && (
                        <div>
                          <label className="block text-sm font-medium text-blue-700 mb-1">Số lượng tồn kho</label>
                          <input
                            type="number"
                            name="soLuongTon"
                            className="w-full rounded-xl border border-blue-200 p-2.5 text-sm outline-none focus:border-blue-500 bg-blue-50/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="Số lượng nhập kho mặc định"
                            value={form.soLuongTon}
                            onChange={handleInputChange}
                          />
                        </div>
                      )}
                    </div>

                    {/* Mô tả */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả sản phẩm</label>
                      <textarea
                        name="description"
                        rows="2"
                        className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500"
                        value={form.description}
                        onChange={handleInputChange}
                      ></textarea>
                    </div>

                    {/* CHỌN ẢNH TỪ MÁY TÍNH */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hình ảnh sản phẩm</label>
                      <div className="flex items-center gap-4">
                        <input
                          type="file"
                          accept="image/*"
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          onChange={handleImageChange}
                        />
                        {/* Preview ảnh đang chọn hoặc ảnh cũ */}
                        {(selectedImageFile || form.image) && (
                          <div 
                            className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden shrink-0 cursor-zoom-in hover:ring-2 ring-blue-500 transition-all"
                            onClick={() => handleZoomImage(selectedImageFile ? URL.createObjectURL(selectedImageFile) : form.image)}
                          >
                            <img 
                              src={selectedImageFile 
                                ? URL.createObjectURL(selectedImageFile) 
                                : (form.image.startsWith('http') ? form.image : `${SERVER_URL}${form.image}`)
                              } 
                              alt="preview" 
                              className="w-full h-full object-cover" 
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer các nút bấm */}
                    <div className="flex items-center justify-end gap-3 mt-6 border-t pt-4">
                      <button type="button" onClick={resetForm} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSubmitting ? "Đang xử lý..." : "Lưu dữ liệu"}
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
                <div className="relative max-w-4xl max-h-[90vh]">
                  <button className="absolute -top-10 right-0 text-white hover:text-gray-300 font-bold text-xl">✕ Đóng</button>
                  <img 
                    src={zoomedImage} 
                    alt="Large view" 
                    className="w-full h-full object-contain rounded-lg shadow-2xl" 
                  />
                </div>
              </div>
            )}
          </>
        );
      }}
    </MainLayout>
  );
}