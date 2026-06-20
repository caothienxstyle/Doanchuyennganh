import { useEffect, useState, useMemo, useRef } from "react";
import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { Search, FileText, CheckCircle2, Clock, Truck, Plus, Package, XCircle } from "lucide-react";
import { 
  getAllPhieuNhap, 
  createPhieuNhap, 
  updatePhieuNhap, 
  getChiTietPhieuNhap
} from "../services/phieuNhapService";
import { useNavigate, useLocation } from "react-router-dom";

export default function ImportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [phieuNhapList, setPhieuNhapList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [allProducts, setAllProducts] = useState([]);
  const [viTriList, setViTriList] = useState([]);
  const [nhaCungCapList, setNhaCungCapList] = useState([]);
  const [khoList, setKhoList] = useState([]);
  const [activatedWarranties, setActivatedWarranties] = useState([]);

  // 🔢 Trạng thái Phân trang & Tìm kiếm
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [activeKpiFilter, setActiveKpiFilter] = useState(""); // State mới để lọc nhanh từ KPI cards
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState("1");
  const hasPrefilled = useRef(false); // Flag để tránh lặp lại logic pre-fill

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedPhieu, setSelectedPhieu] = useState(null);
  const [chiTietItems, setChiTietItems] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("CREATE"); 
  const [formData, setFormData] = useState({
    MaPhieuNhap: "",
    MaPhieu: "",
    MaNhaCungCap: "1",
    MaKho: "1",
    GhiChu: "",
  });

  const [currentChiTietList, setCurrentChiTietList] = useState([]);
  const [tempItem, setTempItem] = useState({ 
    MaSP: "", 
    SoLuong: "", 
    DonGia: "", 
    MaViTriCode: "",
    NgaySanXuat: "",
    HanSuDung: ""
  });

  const [supplierSearchTerm, setSupplierSearchTerm] = useState(""); // 🔍 Tìm kiếm NCC trong modal
  const [productSearchTermForTempItem, setProductSearchTermForTempItem] = useState(""); // 🔍 Tìm kiếm SP trong modal
  // ==========================================
  // STATE THÊM NHANH SẢN PHẨM (CÓ TẠO MỚI DM/ĐVT)
  // ==========================================
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [quickCategories, setQuickCategories] = useState([]); // { id, name }[]
  const [quickUnits, setQuickUnits] = useState([]); // { id, name }[]
  
  // Trạng thái bật tắt ô nhập text khi muốn thêm mới
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [isCreatingNewUnit, setIsCreatingNewUnit] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [customUnit, setCustomUnit] = useState("");

  const [quickProductForm, setQuickProductForm] = useState({
    maSp: "",
    name: "",
    maDanhMuc: "", // Lưu ID danh mục
    maDonVi: "", // Lưu ID đơn vị tính
    barcode: "",
    minQuantity: "0",
    soLuongTon: "0",
    imageUrl: "", 
    description: "",
  });
  const [quickProductError, setQuickProductError] = useState("");
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);

  // ==========================================
  // STATE THÊM NHANH NHÀ CUNG CẤP
  // ==========================================
  const [isQuickNCCModalOpen, setIsQuickNCCModalOpen] = useState(false);
  const [nccFormData, setNccFormData] = useState({
    MaNCCCode: "",
    TenNCC: "",
    NguoiLienHe: "",
    SDT: "",
    Email: "",
    DiaChi: ""
  });

  const loadDanhSachNCC = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const response = await fetch("http://localhost:3000/nhacungcap/danhsach", { 
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      const res = await response.json();
      if (Array.isArray(res)) setNhaCungCapList(res);
      else if (res && (res.success || res.data)) setNhaCungCapList(res.data || []);
    } catch (err) {
      console.error("Không thể lấy dữ liệu nhà cung cấp:", err);
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

  // Tải danh sách sản phẩm
  const loadProducts = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const response = await fetch("http://localhost:3000/products/danhsachsanpham", { 
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const res = await response.json();
      
      let rawProducts = [];
      if (Array.isArray(res)) rawProducts = res;
      else if (res && res.success) rawProducts = res.data || [];
      else if (res && res.data) rawProducts = Array.isArray(res.data) ? res.data : [];
      
      setAllProducts(rawProducts);

      if (rawProducts.length > 0) {
        // Bóc tách danh mục (lấy cả ID và tên)
        const categoryMap = new Map();
        rawProducts.forEach(p => {
          const catId = p.MaDanhMuc || p.madanhmuc || "";
          const catName = p.TenDanhMuc || p.tendanhmuc || p.categoryName || p.CategoryName || p.tenDanhMuc || "";
          if (catId && catName) {
            categoryMap.set(catId, catName);
          }
        });
        setQuickCategories(Array.from(categoryMap.entries()).map(([id, name]) => ({ id, name })));

        // Bóc tách đơn vị tính (lấy cả ID và tên)
        const unitMap = new Map();
        rawProducts.forEach(p => {
          const unitId = p.MaDonVi || p.madonvi || "";
          const unitName = p.TenDonVi || p.tendonvi || p.unitName || p.UnitName || p.tenDonVi || p.DonViTinh || p.donViTinh || "";
          if (unitId && unitName) {
            unitMap.set(unitId, unitName);
          }
        });
        setQuickUnits(Array.from(unitMap.entries()).map(([id, name]) => ({ id, name })));
      }
    } catch (err) {
      console.error("Không thể tải danh sách sản phẩm:", err);
    }
  };

  const loadPhieuNhap = async () => {
    try {
      setLoading(true);
      const res = await getAllPhieuNhap();
      if (res.success) setPhieuNhapList(res.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Lỗi tải dữ liệu phiếu nhập.");
    } finally {
      setLoading(false);
    }
  };

  // Tải danh sách bảo hành để đối chiếu trạng thái kích hoạt
  const loadActivatedWarranties = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const response = await fetch("http://localhost:3000/phieubaohanh/danhsach", { 
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const res = await response.json();
      if (res.success) setActivatedWarranties(res.data || []);
    } catch (err) {
      console.error("Lỗi tải danh sách bảo hành:", err);
    }
  };

  useEffect(() => {
    loadPhieuNhap();
    loadProducts();
    loadDanhSachNCC();
    loadKhoList();
    loadActivatedWarranties();
    const loadViTriKho = async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
        const response = await fetch("http://localhost:3000/vitrikho/danhsach", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });
        if (response.ok) {
          const res = await response.json();
          if (Array.isArray(res)) setViTriList(res);
          else if (res && res.success) setViTriList(res.data || []);
        } else {
          throw new Error("API chưa sẵn sàng");
        }
      } catch (err) {
        console.error("Không thể tải dữ liệu vị trí kho:", err);
      }
    };
    loadViTriKho();
  }, []);

  // 🚀 LOGIC ĐÓN SẢN PHẨM TỪ BÁO CÁO (THÔNG MINH HÓA PRE-FILL)
  useEffect(() => {
    // Đợi đầy đủ Master Data (Sản phẩm, Vị trí, NCC, Kho) để điền form chính xác 100%
    if (location.state?.action === "PREFILL_IMPORT" && 
        !hasPrefilled.current && 
        allProducts.length > 0 && 
        viTriList.length > 0 && 
        nhaCungCapList.length > 0 && 
        khoList.length > 0) {
          
      const p = location.state.product;
      
      setModalMode("CREATE");
      
      // 1. Điền thông tin phiếu nhập tổng quát (Tự chọn NCC và Kho)
      setFormData({
        MaPhieuNhap: "",
        MaPhieu: `PN-AUTO-${Date.now().toString().slice(-6)}`,
        MaNhaCungCap: "",// 🌟 Tự động chọn NCC đầu tiên
        MaKho: String(p.MaKho || "1"),
        GhiChu: `Nhập bổ sung cho mặt hàng ${p.name} từ báo cáo tồn kho.`,
      });

      // 2. Đưa sản phẩm và vị trí kho vào bảng chi tiết ngay lập tức
      const locCode = String(p.MaViTriCode || "").trim();
      setCurrentChiTietList([{
        MaSP: Number(p.MaSP),
        TenSP: p.name, // Thêm trường hiển thị tên sản phẩm cho dễ nhìn
        SoLuong: 0, // Mặc định số lượng bổ sung tối thiểu
        DonGia: 0,
        MaViTriCode: locCode || "VT001",
        NgaySanXuat: null,
        HanSuDung: null
      }]);

      // 3. 🌟 ĐỒNG BỘ TIÊU ĐIỂM: Điền luôn vào khu vực "Thêm nhanh" để người dùng thấy rõ Tên SP và Vị trí
      setTempItem(prev => ({
        ...prev,
        MaSP: Number(p.MaSP),
        MaViTriCode: locCode || "VT001"
      }));

      setIsFormModalOpen(true);
      hasPrefilled.current = true;
      
      // Xóa state để khi refresh trang không bị mở lại modal cũ
      window.history.replaceState({}, document.title);
    }
  }, [location.state, allProducts, viTriList, nhaCungCapList, khoList]);

  // 🚀 Tự động khôi phục bộ lọc trạng thái từ Dashboard (nếu có)
  useEffect(() => {
    const savedFilter = localStorage.getItem('importStatusFilter');
    if (savedFilter) {
      setStatusFilter(savedFilter);
      localStorage.removeItem('importStatusFilter');
    }

    const savedDate = localStorage.getItem('importDateFilter');
    if (savedDate) {
      setDateFilter(savedDate);
      localStorage.removeItem('importDateFilter');
    }
  }, []);

  // � Tự động reset trang khi tìm kiếm hoặc lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter, itemsPerPage]);

  // Đồng bộ ô nhập trang
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // 🔍 LOGIC LỌC DỮ LIỆU THÔNG MINH
  const filteredList = useMemo(() => {
    let listToFilter = phieuNhapList;

    // Áp dụng bộ lọc từ KPI cards trước
    if (activeKpiFilter === "COMPLETED") {
      listToFilter = listToFilter.filter(p => String(p.TrangThai).includes("Duyet") && !String(p.TrangThai).includes("Cho"));
    } else if (activeKpiFilter === "PENDING") {
      listToFilter = listToFilter.filter(p => String(p.TrangThai).includes("Cho"));
    }

    return listToFilter.filter((phieu) => {
      const search = searchTerm.toLowerCase().trim();
      const ncc = nhaCungCapList.find(item => String(item.MaNCC) === String(phieu.MaNCC));
      const tenNCC = ncc ? ncc.TenNCC.toLowerCase() : "";
      
      const matchesSearch = search === "" || 
        String(phieu.MaPhieu || "").toLowerCase().includes(search) ||
        tenNCC.includes(search);
      
      const matchesStatus = statusFilter === "" || 
        String(phieu.TrangThai || "").includes(statusFilter);

      const matchesDate = !dateFilter || (phieu.NgayNhap && phieu.NgayNhap.startsWith(dateFilter));

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [phieuNhapList, searchTerm, statusFilter, dateFilter, nhaCungCapList, activeKpiFilter]);

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

  const handleOpenQuickProductModal = async () => {
    await loadProducts(); 
    setQuickProductForm({
      maSp: "", 
      name: "",
      maDanhMuc: "",
      maDonVi: "",
      barcode: "",
      minQuantity: "0",
      soLuongTon: "0",
      imageUrl: "",
      description: "",
    });
    // Reset trạng thái thêm mới tự chọn
    setIsCreatingNewCategory(false);
    setIsCreatingNewUnit(false);
    setCustomCategory("");
    setCustomUnit("");
    setQuickProductError("");
    setIsQuickProductModalOpen(true);
  };

  // Theo dõi sự thay đổi của Select Danh mục
  const handleCategorySelectChange = (e) => {
    const value = e.target.value;
    if (value === "__NEW__") {
      setIsCreatingNewCategory(true);
      setQuickProductForm({ ...quickProductForm, maDanhMuc: "" });
    } else {
      setIsCreatingNewCategory(false);
      setQuickProductForm({ ...quickProductForm, maDanhMuc: value });
    }
  };

  // Theo dõi sự thay đổi của Select Đơn vị tính
  const handleUnitSelectChange = (e) => {
    const value = e.target.value;
    if (value === "__NEW__") {
      setIsCreatingNewUnit(true);
      setQuickProductForm({ ...quickProductForm, maDonVi: "" });
    } else {
      setIsCreatingNewUnit(false);
      setQuickProductForm({ ...quickProductForm, maDonVi: value });
    }
  };

  const handleQuickProductSubmit = async (e) => {
    e.preventDefault();
    setQuickProductError("");

    // Kiểm tra điều kiện chặn lỗi (Validation)
    if (!quickProductForm.name.trim()) {
      setQuickProductError("Vui lòng nhập tên sản phẩm.");
      return;
    }
    
    const finalMaDanhMuc = isCreatingNewCategory ? customCategory.trim() : quickProductForm.maDanhMuc;
    const finalMaDonVi = isCreatingNewUnit ? customUnit.trim() : quickProductForm.maDonVi;

    if (!finalMaDanhMuc) {
      setQuickProductError("Vui lòng chọn hoặc nhập danh mục sản phẩm.");
      return;
    }
    if (!finalMaDonVi) {
      setQuickProductError("Vui lòng chọn hoặc nhập đơn vị tính.");
      return;
    }

    const token = localStorage.getItem("token") || "";
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };

    // Bước 1: Chuẩn bị payload - MaDanhMuc/MaDonVi có thể là ID (số) hoặc Tên mới (chuỗi)
    const maDanhMucPayload = isNaN(Number(finalMaDanhMuc)) || finalMaDanhMuc === "" ? finalMaDanhMuc : Number(finalMaDanhMuc);
    const maDonViPayload = isNaN(Number(finalMaDonVi)) || finalMaDonVi === "" ? finalMaDonVi : Number(finalMaDonVi);

    const productPayload = {
      MaSP: quickProductForm.maSp.trim() || undefined,
      Barcode: quickProductForm.barcode.trim() || undefined,
      TenSanPham: quickProductForm.name.trim(),
      MaDanhMuc: maDanhMucPayload,
      MaDonVi: maDonViPayload,
      HinhAnh: quickProductForm.imageUrl.trim() || undefined, 
      MoTa: quickProductForm.description.trim(),
      SoLuongToiThieu: Number(quickProductForm.minQuantity) || 0,
      SoLuongTon: Number(quickProductForm.soLuongTon) || 0
    };

    console.log("📤 Gửi payload:", productPayload);

    try {
      setIsQuickSubmitting(true);
      const prodResponse = await fetch("http://localhost:3000/products/taosanpham", { 
        method: "POST",
        headers,
        body: JSON.stringify(productPayload)
      });

      const prodRes = await prodResponse.json().catch(() => ({}));

      if (!prodResponse.ok) {
        // 🛡️ Bắt lỗi khi chức năng đã bị gỡ bỏ hoặc bị chặn quyền ở Backend
        if (prodResponse.status === 500 || prodResponse.status === 403) {
          throw new Error("Tài khoản của bạn không có quyền thực hiện chức năng này hoặc chức năng đã bị quản trị viên tạm gỡ bỏ.");
        }
        throw new Error(prodRes.message || `Lỗi hệ thống (${prodResponse.status})`);
      }

      if (!prodRes.success) throw new Error(prodRes.message || "Không thể lưu sản phẩm.");
      
      // Bước 2: Lấy thông tin SP vừa tạo và đẩy thẳng vào danh sách dòng hàng của phiếu nhập
      const newProduct = prodRes.data;
      const productId = newProduct?.id || newProduct?.MaSanPham || newProduct?.masanpham;

      if (productId) {
        const newRow = {
          MaSP: Number(productId),
          SoLuong: Number(quickProductForm.soLuongTon) || 0,
          DonGia: 0, // Mặc định 0 để người dùng tự điền giá nhập thực tế
          MaViTriCode: tempItem.MaViTriCode || (filteredLocations.length > 0 ? filteredLocations[0].MaViTriCode : ""),
          NgaySanXuat: null,
          HanSuDung: null
        };
        
        // Chỉ tự động push vào bảng nếu người dùng có nhập số lượng tồn ban đầu > 0
        if (newRow.SoLuong > 0) {
          setCurrentChiTietList(prev => [...prev, newRow]);
        }
      }

      // Bước 3: Chạy ngầm load lại danh sách sản phẩm/danh mục/đơn vị để đồng bộ các ô Select
      loadProducts();

      setIsQuickProductModalOpen(false);
      alert("✅ Thêm sản phẩm mới thành công! Sản phẩm đã có sẵn trong danh sách.");
      
      // Reset form
      setQuickProductForm({
        maSp: "",
        name: "",
        maDanhMuc: "",
        maDonVi: "",
        barcode: "",
        minQuantity: "0",
        soLuongTon: "0",
        imageUrl: "", 
        description: "",
      });
    } catch (err) {
      console.error("Lỗi tạo sản phẩm:", err);
      setQuickProductError(err?.message || "Không thể lưu sản phẩm. Vui lòng kiểm tra kết nối hoặc thử lại.");
    } finally {
      setIsQuickSubmitting(false);
    }
  };

  const handleQuickNCCSubmit = async (e) => {
    e.preventDefault();
    if (!nccFormData.TenNCC.trim()) {
      alert("Tên nhà cung cấp bắt buộc phải điền!");
      return;
    }

    try {
      const token = localStorage.getItem("token") || "";
      const response = await fetch("http://localhost:3000/nhacungcap/taomoi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(nccFormData)
      });
      const res = await response.json();
      if (res.success) {
        alert("✅ Thêm nhà cung cấp mới thành công!");
        await loadDanhSachNCC();
        
        // Tự động chọn NCC vừa tạo vào phiếu nhập
        const newId = res.data?.id || res.data?.MaNhaCungCap || res.data?.MaNCC;
        if (newId) {
          setFormData(prev => ({ ...prev, MaNhaCungCap: String(newId) }));
        }
        setIsQuickNCCModalOpen(false);
      } else {
        alert("Lỗi: " + res.message);
      }
    } catch (err) {
      alert("Lỗi kết nối tạo nhà cung cấp: " + err.message);
    }
  };

  const formatLocationString = (vt) => {
    if (!vt) return "";
    // Ưu tiên hiển thị tên cấu hình sẵn, nếu không có thì ghép từ các trường Khu/Dãy/Tầng/Ô
    return vt.TenViTriHienThi || 
      [vt.KhuVuc, vt.DayKe, vt.Tang, vt.OKe].filter(Boolean).join(" / ") || 
      vt.MaViTriCode || "Chưa xác định";
  };

  // Helper: Định dạng số có dấu chấm hàng nghìn (VD: 1.000.000)
  const formatNumberWithDots = (val) => {
    if (val === undefined || val === null || val === "") return "";
    return String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  // Helper: Gỡ bỏ dấu chấm để lấy giá trị số nguyên phục vụ tính toán
  const parseNumberFromDots = (val) => {
    return String(val).replace(/\D/g, "");
  };

  // 🚀 Lọc danh sách nhà cung cấp trong Modal để người dùng chọn nhanh hơn
  const filteredNhaCungCapForModal = useMemo(() => {
    if (!supplierSearchTerm.trim()) return nhaCungCapList;
    const s = supplierSearchTerm.toLowerCase();
    return nhaCungCapList.filter(ncc => 
      String(ncc.TenNCC || "").toLowerCase().includes(s) ||
      String(ncc.MaNCCCode || "").toLowerCase().includes(s)
    );
  }, [nhaCungCapList, supplierSearchTerm]);

  // 🚀 Lọc danh sách sản phẩm trong Modal để người dùng chọn nhanh hơn
  const filteredProductsForTempItem = useMemo(() => {
    if (!productSearchTermForTempItem.trim()) return allProducts;
    const s = productSearchTermForTempItem.toLowerCase();
    return allProducts.filter(p => 
      String(p.name || p.TenSanPham || "").toLowerCase().includes(s) ||
      String(p.code || p.MaSP || "").toLowerCase().includes(s)
    );
  }, [allProducts, productSearchTermForTempItem]);

  // Helper để tìm sản phẩm đã chọn (dùng cho hiển thị tag)
  const getSelectedProductInfo = useMemo(() => {
    if (!tempItem.MaSP) return null;
    return allProducts.find(p => String(p.id || p.MaSanPham || p.masanpham) === String(tempItem.MaSP));
  }, [tempItem.MaSP, allProducts]);

  const filteredLocations = viTriList.filter((loc) => String(loc.MaKho) === String(formData.MaKho));

  useEffect(() => {
    if (filteredLocations.length > 0) {
      setTempItem((prev) => ({ ...prev, MaViTriCode: filteredLocations[0].MaViTriCode }));
    } else {
      setTempItem((prev) => ({ ...prev, MaViTriCode: "" }));
    }
  }, [formData.MaKho, viTriList]);

  const handleViewDetail = async (row) => {
    try {
      setSelectedPhieu(row);
      setIsViewModalOpen(true);
      setLoadingDetail(true);
      const res = await getChiTietPhieuNhap(row.MaPhieuNhap);
      if (res.success) setChiTietItems(res.data || []);
    } catch (err) {
      alert("Không thể tải chi tiết sản phẩm: " + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOpenUpdate = async (row) => {
    if (row.TrangThai === "DaDuyet" || row.TrangThai === "Đã duyệt") {
      alert("Không thể sửa phiếu nhập đã duyệt thành công!");
      return;
    }
    try {
      setModalMode("UPDATE");
      setFormData({
        MaPhieuNhap: row.MaPhieuNhap || "",
        MaPhieu: row.MaPhieu || "",
        MaNhaCungCap: row.MaNCC || "1",
        MaKho: row.MaKho || "1",
        GhiChu: row.GhiChu || "",
      });

      setSupplierSearchTerm(""); // Reset tìm kiếm NCC khi mở sửa
      const res = await getChiTietPhieuNhap(row.MaPhieuNhap);
      if (res.success && Array.isArray(res.data)) {
        const mappedDetails = res.data.map(item => {
          // 🔍 Giải quyết vấn đề 'locCode: 1': Tìm Mã Code thực tế từ ID số nếu BE trả về ID
          let resolvedCode = item.MaViTriCode || item.mavitricode;
          if (!resolvedCode && (item.MaViTri || item.mavitri)) {
            const found = viTriList.find(v => String(v.MaViTri || v.mavitri) === String(item.MaViTri || item.mavitri));
            if (found) resolvedCode = found.MaViTriCode || found.mavitricode;
          }

          return {
            MaSP: Number(item.MaSP || item.MaSPCode || item.MaSanPham || item.masanpham),
            SoLuong: Number(item.SoLuong || 0),
            DonGia: Number(item.DonGia || 0),
            MaViTriCode: String(resolvedCode || item.MaViTri || item.mavitri || "").trim(),
            NgaySanXuat: item.NgaySanXuat ? item.NgaySanXuat.split("T")[0] : "",
            HanSuDung: item.HanSuDung ? item.HanSuDung.split("T")[0] : ""
          };
        });
        setCurrentChiTietList(mappedDetails);
        setProductSearchTermForTempItem(""); // Reset tìm kiếm SP khi mở sửa
      }
      setIsFormModalOpen(true);
    } catch (err) {
      alert("Lỗi lấy dữ liệu chi tiết phiếu: " + err.message);
    }
  };

  const handleInlineChange = (index, field, value) => {
    const updatedList = [...currentChiTietList];
    if (field === "MaViTriCode" || field === "NgaySanXuat" || field === "HanSuDung") {
      updatedList[index] = { ...updatedList[index], [field]: value };
    } else {
      updatedList[index] = { ...updatedList[index], [field]: value === "" ? "" : Number(value) };
    }
    setCurrentChiTietList(updatedList);
  };

  const handleAddProductRow = () => {
    // Kiểm tra chi tiết từng trường để báo lỗi chính xác
    if (!tempItem.MaSP) return alert("Vui lòng chọn một sản phẩm!");
    if (!tempItem.SoLuong || Number(tempItem.SoLuong) <= 0) return alert("Vui lòng nhập số lượng lớn hơn 0!");
    if (tempItem.DonGia === "" || Number(tempItem.DonGia) <= 0) return alert("Vui lòng nhập đơn giá lớn hơn 0!");
    
    if (!tempItem.MaViTriCode) {
      alert("Lỗi: Vị trí lưu trữ đang trống. Vui lòng chọn kho có cấu hình vị trí!");
      return;
    }

    const existingIndex = currentChiTietList.findIndex(
      item => String(item.MaSP) === String(tempItem.MaSP) && 
              String(item.MaViTriCode) === String(tempItem.MaViTriCode) &&
              String(item.HanSuDung || "") === String(tempItem.HanSuDung || "")
    );

    if (existingIndex !== -1) {
      const updatedList = [...currentChiTietList];
      updatedList[existingIndex].SoLuong += Number(tempItem.SoLuong);
      updatedList[existingIndex].DonGia = Number(tempItem.DonGia); 
      setCurrentChiTietList(updatedList);
    } else {
      setCurrentChiTietList([
        ...currentChiTietList,
        {
          MaSP: Number(tempItem.MaSP), // Đồng bộ kiểu số
          SoLuong: Number(tempItem.SoLuong),
          DonGia: Number(tempItem.DonGia),
          MaViTriCode: String(tempItem.MaViTriCode),
          NgaySanXuat: tempItem.NgaySanXuat || null,
          HanSuDung: tempItem.HanSuDung || null
        }
      ]);
    }

    // Reset form nhưng giữ lại Vị trí mặc định để ông không phải chọn lại
    const defaultLoc = filteredLocations.length > 0 ? filteredLocations[0].MaViTriCode : "";
    
    setTempItem({ 
      MaSP: "", 
      SoLuong: "", 
      DonGia: "", 
      MaViTriCode: defaultLoc,
      NgaySanXuat: "", 
      HanSuDung: "" 
    });
  };

  const handleRemoveProductRow = (index) => {
    setCurrentChiTietList(currentChiTietList.filter((_, i) => i !== index));
  };

  const calculatedTotal = currentChiTietList.reduce((sum, item) => sum + (item.SoLuong * item.DonGia), 0);

const handleOpenCreate = () => {
  setModalMode("CREATE");
  setFormData({
    MaPhieuNhap: "",
    MaPhieu: `PN${Date.now().toString().slice(-6)}`,
    MaNhaCungCap: "", // Đổi từ "1" thành "" để mặc định hiển thị chữ "-- Chọn nhà cung cấp --"
    MaKho: "1",       // Giữ nguyên kho mặc định là kho số 1 (hoặc "" nếu muốn họ tự chọn)
    GhiChu: "",
  });
  setCurrentChiTietList([]);
  setIsFormModalOpen(true);
  setSupplierSearchTerm(""); // Reset tìm kiếm NCC
  setProductSearchTermForTempItem(""); // Reset tìm kiếm SP
};
  const handleSubmitForm = async (e) => {
    e.preventDefault();

    if (!formData.MaNhaCungCap) {
      alert("Vui lòng chọn đối tác cung ứng (Nhà cung cấp) trước khi lưu phiếu!");
      return;
    }

    if (currentChiTietList.length === 0) {
      alert("Phiếu nhập phải có ít nhất 1 mặt hàng!");
      return;
    }

    if (calculatedTotal <= 0) {
      alert("Lỗi: Tổng giá trị thành tiền của phiếu nhập phải lớn hơn 0!");
      return;
    }

    // 🛡️ KIỂM TRA TÍNH LOGIC: Đảm bảo mọi dòng hàng đều có Vị trí kho hợp lệ thuộc Kho đã chọn
    const validLocCodes = new Set(filteredLocations.map(l => String(l.MaViTriCode || l.mavitricode || "").trim()));
    const validLocIds = new Set(filteredLocations.map(l => String(l.MaViTri || l.mavitri || "").trim()));
    
    const hasInvalidItem = currentChiTietList.some((item, idx) => {
      const locCode = String(item.MaViTriCode || "").trim();
      // Kiểm tra xem giá trị hiện tại có khớp với bất kỳ Mã Code hoặc ID nào của kho đang chọn không
      const isLocValid = validLocCodes.has(locCode) || validLocIds.has(locCode);
      const isQtyValid = Number(item.SoLuong) > 0;
      const isPriceValid = Number(item.DonGia) > 0;
      
      if (!isLocValid || !isQtyValid || !isPriceValid) {
        console.warn(`Dòng hàng #${idx + 1} không hợp lệ:`, { locCode, isLocValid, isQtyValid, isPriceValid });
        return true;
      }
      return false;
    });

    if (hasInvalidItem) {
      alert("Dữ liệu không hợp lệ! Vui lòng kiểm tra lại bảng hàng hóa:\n1. Đảm bảo mọi sản phẩm đều đã được gán Vị trí kho chính xác (thuộc đúng kho đang chọn bên trên).\n2. Số lượng và đơn giá phải lớn hơn 0.");
      return;
    }

    try {
      const payload = {
        MaPhieuNhap: formData.MaPhieuNhap ? Number(formData.MaPhieuNhap) : undefined,
        MaPhieu: formData.MaPhieu,
        MaNhaCungCap: Number(formData.MaNhaCungCap),
        MaKho: Number(formData.MaKho),
        TongTien: calculatedTotal,
        GhiChu: formData.GhiChu,
        ChiTiet: currentChiTietList.map(item => {
          // 🔍 Tìm ID số (MaViTri) từ danh sách gốc dựa trên Code đang có trong hàng
          const foundLoc = viTriList.find(v => 
            String(v.MaViTriCode || v.mavitricode) === String(item.MaViTriCode).trim() ||
            String(v.MaViTri || v.mavitri) === String(item.MaViTriCode).trim()
          );
          return {
            MaSP: item.MaSP,
            SoLuong: item.SoLuong,
            DonGia: item.DonGia,
            // 🛡️ Gửi đồng thời cả ID số (MaViTri) để Backend không bị lỗi NULL
            MaViTri: foundLoc ? (foundLoc.MaViTri || foundLoc.mavitri) : null,
            MaViTriCode: item.MaViTriCode,
            NgaySanXuat: item.NgaySanXuat || null,
            HanSuDung: item.HanSuDung || null
          };
        })
      };

      const res = modalMode === "CREATE" ? await createPhieuNhap(payload) : await updatePhieuNhap(payload);
      if (res.success) {
        alert("Lưu thông tin phiếu nhập thành công!");
        setIsFormModalOpen(false);
        await loadPhieuNhap();
      }
    } catch (err) {
      alert(`Lỗi lưu phiếu: ${err?.response?.data?.message || err.message}`);
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

  return (
    <MainLayout>
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Quản lý Phiếu Nhập Hàng</h2>
          <p className="text-sm text-gray-400 mt-1">Quản lý biên nhận hàng hóa và phân phối vị trí kho</p>
        </div>
        <button onClick={handleOpenCreate} className="rounded-xl bg-blue-600 px-5 py-2.5 text-white text-sm hover:bg-blue-700 font-bold transition-all shadow-md flex items-center gap-2">
          <FileText size={18}/> + Tạo phiếu nhập mới
        </button>
      </div>

      {/* KPI STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"> 
        <div 
          onClick={() => setActiveKpiFilter("")}
          className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${activeKpiFilter === "" ? "border-blue-500 ring-2 ring-blue-500/10 shadow-md" : "border-gray-100 hover:border-blue-200"}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeKpiFilter === "" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}>
            <Truck size={20}/>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Tổng nhập kho</p>
            <h3 className="text-xl font-bold text-gray-800">{phieuNhapList.length} <span className="text-xs font-normal text-gray-400">Phiếu</span></h3>
          </div>
        </div>
        <div 
          onClick={() => setActiveKpiFilter("COMPLETED")}
          className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${activeKpiFilter === "COMPLETED" ? "border-green-500 ring-2 ring-green-500/10 shadow-md" : "border-gray-100 hover:border-green-200"}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeKpiFilter === "COMPLETED" ? "bg-green-600 text-white" : "bg-green-50 text-green-600"}`}>
            <CheckCircle2 size={20}/>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Đã hoàn tất</p>
            <h3 className="text-xl font-bold text-green-600">{phieuNhapList.filter(p => String(p.TrangThai).includes("Duyet") && !String(p.TrangThai).includes("Cho")).length}</h3>
          </div>
        </div>
        <div 
          onClick={() => setActiveKpiFilter("PENDING")}
          className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${activeKpiFilter === "PENDING" ? "border-amber-500 ring-2 ring-amber-500/10 shadow-md" : "border-gray-100 hover:border-amber-200"}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeKpiFilter === "PENDING" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-600"}`}>
            <Clock size={20}/>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Đang chờ duyệt</p>
            <h3 className="text-xl font-bold text-amber-600">{phieuNhapList.filter(p => String(p.TrangThai).includes("Cho")).length}</h3>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tìm kiếm thông minh</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
              <input
                type="text"
                placeholder="Nhập mã phiếu, tên nhà cung cấp..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Trạng thái</label>
            <select 
              className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">— Tất cả trạng thái —</option>
              <option value="ChoDuyet">Chờ duyệt</option>
              <option value="DaDuyet">Đã nhập kho</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Hiển thị</label>
            <select 
              className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
            >
              <option value={10}>10 phiếu / trang</option>
              <option value={20}>20 phiếu / trang</option>
              <option value={50}>50 phiếu / trang</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="flex items-center justify-center p-12 text-gray-400 animate-pulse">⏳ Đang đồng bộ hồ sơ phiếu nhập...</div>}
      {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 mb-6 text-sm">⚠️ {error}</div>}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <DataTable
          columns={[
            { key: "MaPhieu", label: "Mã phiếu" },
            { 
                key: "MaNCC", 
                label: "Nhà cung cấp", 
                render: (v, row) => {
                  const ncc = nhaCungCapList.find(item => String(item.MaNCC) === String(v || row.MaNCC));
                  return ncc ? (
                    <span className="font-medium text-gray-800">{ncc.TenNCC}</span>
                  ) : (
                    <span className="text-gray-400 font-mono">Mã NCC: #{v}</span>
                  );
                }
              },
            { key: "NgayNhap", label: "Ngày nhập", render: (v) => v ? new Date(v).toLocaleString("vi-VN") : "—" },
            { key: "TongTien", label: "Tổng tiền", render: (v) => formatCurrency(v || 0) },
            { key: "TrangThai", label: "Trạng thái", render: (v) => <StatusBadge status={v === "ChoDuyet" ? "Chờ duyệt" : v === "DaDuyet" ? "Đã duyệt" : v} /> },
            {
              key: "warranty",
              label: "Bảo hành",
              render: (_, row) => {
                const isActivated = activatedWarranties.some(w => String(w.MaPhieuGoc) === String(row.MaPhieu));
                if (isActivated) return <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-1 rounded border border-emerald-100">Đã kích hoạt</span>;
                if (row.TrangThai === "DaDuyet" || row.TrangThai === "Đã duyệt") return <button onClick={() => navigate("/PhieuBaoHanh", { state: { maPhieu: row.MaPhieu, type: "IMPORT" } })} className="text-blue-600 hover:underline text-[10px] font-bold">Kích hoạt BH</button>;
                return <span className="text-gray-300 text-[10px] italic">Chưa duyệt</span>;
              }
            },
            {
              key: "actions",
              label: "Hành động",
              render: (_, row) => (
                <div className="flex space-x-2 items-center">
                  <button onClick={() => handleViewDetail(row)} className="text-blue-600 hover:text-blue-800 text-xs bg-blue-50 px-2 py-1 rounded font-medium">Xem sản phẩm</button>
                  {(row.TrangThai === "ChoDuyet" || row.TrangThai === "Chờ duyệt") && (
                    <button onClick={() => handleOpenUpdate(row)} className="text-amber-600 hover:text-amber-800 text-xs bg-amber-50 px-2 py-1 rounded font-medium">Sửa phiếu</button>
                  )}
                </div>
              ),
            },
          ]}
          data={paginatedList}
        />
        {filteredList.length === 0 && (
          <div className="p-12 text-center text-gray-400 text-sm">📭 Không tìm thấy kết quả phiếu nhập phù hợp.</div>
        )}
        </div>
      )}

      {/* PAGINATION NAVIGATION */}
      {!loading && !error && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-500">
          <div>
            Hiển thị từ <span className="font-bold text-gray-800">{indexOfFirstItem + 1}</span> đến{" "}
            <span className="font-bold text-gray-800">{Math.min(indexOfLastItem, totalItems)}</span> trên tổng số{" "}
            <span className="font-bold text-gray-800">{totalItems}</span> hồ sơ
          </div>

          <div className="flex items-center space-x-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all font-medium text-xs">« Đầu</button>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all font-medium text-xs">‹ Trước</button>
            
            <div className="flex items-center space-x-1.5 px-3 py-1 border border-gray-200 rounded-lg bg-gray-50/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Trang</span>
              <input 
                type="number" 
                min="1" 
                max={totalPages} 
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

      {/* MODAL 1: XEM CHI TIẾT SẢN PHẨM PHIẾU */}
      {isViewModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Chi tiết sản phẩm thuộc phiếu: {selectedPhieu?.MaPhieu}</h3>
              <button onClick={() => setIsViewModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>
            <div className="p-6 overflow-x-auto">
              {loadingDetail ? <p className="text-sm text-gray-500">Đang tải...</p> : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 text-xs uppercase font-semibold">
                      <th className="p-2 border">Mã SP</th>
                      <th className="p-2 border">Tên Sản Phẩm</th>
                      <th className="p-2 border text-center">NSX / HSD</th>
                      <th className="p-2 border text-right">Số lượng</th>
                      <th className="p-2 border text-right">Đơn giá</th>
                      <th className="p-2 border text-right">Thành tiền</th>
                      <th className="p-2 border text-center">Vị trí kho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chiTietItems.map((item, index) => {
                      // Tìm kiếm thông tin sản phẩm trong danh sách allProducts để lấy Mã định danh (MaSP) thay vì ID tự tăng
                      const productInfo = allProducts.find(p => String(p.id || p.MaSanPham || p.masanpham) === String(item.MaSanPham || item.masanpham));
                      
                      const maSP = productInfo?.MaSP || productInfo?.code || item.MaSP || item.MaSPCode || item.MaSanPham || item.masanpham || "—";
                      const tenSP = item.TenSanPham || item.tensanpham || productInfo?.TenSanPham || productInfo?.name || `Sản phẩm mã #${maSP}`;
                      
                      // Đồng bộ phím dữ liệu (Cả viết hoa và viết thường)
                      const maViTri = item.MaViTriCode || item.mavitricode || item.MaViTri || item.mavitri || "";
                      
                      // Ghép chuỗi sơ đồ từ các trường BE trả về trực tiếp trong chi tiết phiếu
                      const soDoTuItem = [item.KhuVuc, item.DayKe, item.Tang, item.OKe].filter(val => val !== null && val !== undefined && val !== "").join(" / ");
                      
                      // Fallback: Nếu BE không trả về sơ đồ lẻ, tìm trong danh sách viTriList local
                      const targetLoc = !soDoTuItem ? viTriList.find(l => String(l.MaViTriCode || l.mavitricode) === String(maViTri)) : null;
                      const locationDisplay = soDoTuItem || (targetLoc ? formatLocationString(targetLoc) : (maViTri || "—"));
                      
                      // Hàm format ngày thông minh hơn
                      const formatDate = (val) => {
                        if (!val || String(val).startsWith("0001") || String(val).startsWith("1900") || val === "null") return "—";
                        const d = new Date(val);
                        return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN");
                      };

                      // Đón đầu mọi kiểu đặt tên key từ Backend
                      const nsxStr = formatDate(item.NgaySanXuat || item.ngaySanXuat || item.nsx || item.NSX || item.NgaySX || item.ngay_sx);
                      const hsdStr = formatDate(item.HanSuDung || item.hanSuDung || item.hsd || item.HSD || item.HanSD || item.ngay_hh);

                      return (
                        <tr key={index} className="hover:bg-gray-50 border-b">
                          <td className="p-2 border text-xs font-mono">{maSP}</td>
                          <td className="p-2 border font-medium text-gray-700">{tenSP}</td>
                          <td className="p-2 border text-center text-xs text-gray-600 font-medium">
                            <div>NSX: {nsxStr}</div>
                            <div className="text-amber-700 font-semibold">HSD: {hsdStr}</div>
                          </td>
                          <td className="p-2 border text-right text-emerald-600 font-semibold">{item.SoLuong}</td>
                          <td className="p-2 border text-right">{formatCurrency(item.DonGia)}</td>
                          <td className="p-2 border text-right font-bold text-gray-800">{formatCurrency(item.SoLuong * item.DonGia)}</td>
                          <td className="p-2 border text-center text-xs">
                            <div className="font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-md inline-block">
                              {locationDisplay}
                            </div>
                            {maViTri && <div className="text-[10px] text-gray-400 mt-0.5 font-mono">Mã: {maViTri}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TẠO MỚI HOẶC SỬA PHIẾU NHẬP */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">
                {modalMode === "CREATE" ? "Tạo Phiếu Nhập Hàng" : `Sửa Thông Tin Phiếu ${formData.MaPhieu}`}
              </h3>
              <button onClick={() => setIsFormModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mã Số Phiếu</label>
                  <input type="text" required disabled readOnly className="w-full border rounded-lg p-2 text-sm bg-gray-50 font-mono font-bold text-gray-600" value={formData.MaPhieu} />
                </div>
                <div>
                      <div className="relative">
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs font-medium text-gray-700">Nhà Cung Cấp <span className="text-red-500">*</span></label>
                          <button
                            type="button"
                            onClick={() => {
                              setNccFormData({ MaNCCCode: "", TenNCC: "", NguoiLienHe: "", SDT: "", Email: "", DiaChi: "" });
                              setIsQuickNCCModalOpen(true);
                            }}
                            className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Plus size={12}/> Tạo nhanh NCC
                          </button>
                        </div>
                        {/* 🚀 AUTCOMPLETE CHO NHÀ CUNG CẤP */}
                        {!formData.MaNhaCungCap ? (
                          <div className="space-y-2">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input 
                                type="text"
                                autoFocus
                                placeholder="Gõ tên hoặc mã NCC để tìm nhanh..."
                                className="w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm outline-none focus:border-blue-500 bg-white shadow-sm transition-all"
                                value={supplierSearchTerm}
                                onChange={(e) => setSupplierSearchTerm(e.target.value)}
                              />
                            </div>
                            <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-xl bg-gray-50/50 divide-y divide-gray-100 scrollbar-thin shadow-inner">
                              {filteredNhaCungCapForModal.length > 0 ? (
                                filteredNhaCungCapForModal.slice(0, 50).map((ncc) => (
                                  <div 
                                    key={ncc.MaNCC}
                                    onClick={() => {
                                      setFormData({ ...formData, MaNhaCungCap: ncc.MaNCC });
                                      setSupplierSearchTerm("");
                                    }}
                                    className="p-3 hover:bg-blue-50 cursor-pointer transition-all flex items-center justify-between group"
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold text-gray-700 group-hover:text-blue-700">{ncc.TenNCC}</span>
                                      <span className="text-[10px] text-gray-400 font-mono mt-0.5">Mã NCC: {ncc.MaNCCCode || ncc.MaNCC}</span>
                                    </div>
                                    <Plus size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                                  </div>
                                ))
                              ) : (
                                <div className="p-4 text-center text-xs text-gray-400 italic">Không tìm thấy nhà cung cấp nào...</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-3 border-2 border-blue-100 bg-blue-50/50 rounded-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
                                <Truck size={18} />
                              </div>
                              <div>
                                <p className="text-xs font-black text-blue-900">
                                  {nhaCungCapList.find(n => String(n.MaNCC) === String(formData.MaNhaCungCap))?.TenNCC || "Nhà cung cấp đã chọn"}
                                </p>
                                <p className="text-[10px] font-bold text-blue-500 font-mono uppercase">
                                  Mã NCC: {nhaCungCapList.find(n => String(n.MaNCC) === String(formData.MaNhaCungCap))?.MaNCCCode || "---"}
                                </p>
                              </div>
                            </div>
                            <button 
                              type="button"
                              onClick={() => setFormData({ ...formData, MaNhaCungCap: "" })}
                              className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
                            >
                              <XCircle size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Kho Nhận Hàng</label>
                  <select 
                    required 
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm bg-white font-bold text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                    value={formData.MaKho} 
                    onChange={(e) => setFormData({ ...formData, MaKho: e.target.value })}
                  >
                    {khoList.map(k => (
                      <option key={k.MaKho} value={k.MaKho}>{k.TenKho}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ghi chú phiếu</label>
                <input type="text" className="w-full border rounded-lg p-2 text-sm" value={formData.GhiChu} onChange={(e) => setFormData({ ...formData, GhiChu: e.target.value })} placeholder="Nhập ghi chú biên nhận..." />
              </div>

              <hr />

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                <span className="block text-xs font-bold text-blue-800 uppercase tracking-wider">
                  Thêm nhanh sản phẩm (Đang hiển thị vị trí thuộc Kho {formData.MaKho})
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1 flex justify-between items-center">Chọn Sản Phẩm <span className="text-red-500">*</span>
                      <button type="button" onClick={handleOpenQuickProductModal} className="text-[10px] text-blue-600 font-bold hover:underline">+ Thêm SP mới</button>
                    </label>
                    {/* 🚀 AUTCOMPLETE CHO SẢN PHẨM */}
                    {!tempItem.MaSP ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input 
                            type="text"
                            placeholder="Gõ tên hoặc mã sản phẩm để tìm nhanh..."
                            className="w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm outline-none focus:border-blue-500 bg-white shadow-sm transition-all"
                            value={productSearchTermForTempItem}
                            onChange={(e) => setProductSearchTermForTempItem(e.target.value)}
                          />
                        </div>
                        <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-xl bg-gray-50/50 divide-y divide-gray-100 scrollbar-thin shadow-inner">
                          {filteredProductsForTempItem.length > 0 ? (
                            filteredProductsForTempItem.slice(0, 50).map((p) => (
                              <div 
                                key={p.id || p.MaSanPham}
                                onClick={() => {
                                  setTempItem({ ...tempItem, MaSP: p.id || p.MaSanPham });
                                  setProductSearchTermForTempItem("");
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
                             
                    {getSelectedProductInfo?.TenSanPham || getSelectedProductInfo?.name || "Sản phẩm đã chọn"}
                            </p>
                            <p className="text-[10px] font-bold text-blue-500 font-mono uppercase">
                            
                    Mã SP: {getSelectedProductInfo?.MaSP || getSelectedProductInfo?.code || "---"}
                            </p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setTempItem({ ...tempItem, MaSP: "" })}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Sơ đồ Vị trí xếp</label>
                    <select className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white font-bold text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" value={tempItem.MaViTriCode} onChange={(e) => setTempItem({ ...tempItem, MaViTriCode: e.target.value })}>
                      {filteredLocations.length === 0 && <option value="">❌ Kho chưa cấu hình vị trí</option>}
                      {filteredLocations.map(loc => (
                        <option key={loc.MaViTriCode || loc.mavitricode} value={loc.MaViTriCode || loc.mavitricode}>
                          {formatLocationString(loc)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">SL / Đơn giá</label>
                    <div className="flex space-x-1">
                      <input type="number" min="1" className="w-1/2 border rounded-md p-1.5 text-sm bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={tempItem.SoLuong} onChange={(e) => setTempItem({ ...tempItem, SoLuong: e.target.value })} placeholder="SL" />
                      <input 
                        type="text" 
                        className="w-1/2 border rounded-md p-1.5 text-sm bg-white" 
                        value={formatNumberWithDots(tempItem.DonGia)} 
                        onChange={(e) => setTempItem({ ...tempItem, DonGia: parseNumberFromDots(e.target.value) })} 
                        placeholder="Giá" 
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Ngày sản xuất (NSX)</label>
                    <input type="date" className="w-full border rounded-md p-1 text-sm bg-white text-gray-700" value={tempItem.NgaySanXuat} onChange={(e) => setTempItem({ ...tempItem, NgaySanXuat: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-700 mb-1">Hạn sử dụng (HSD)</label>
                    <input type="date" className="w-full border border-amber-300 rounded-md p-1 text-sm bg-white text-amber-800" value={tempItem.HanSuDung} onChange={(e) => setTempItem({ ...tempItem, HanSuDung: e.target.value })} />
                  </div>
                  <div>
                    <button type="button" onClick={handleAddProductRow} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-md transition-colors">
                      + Đưa Vào Bảng
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-gray-700 mb-2">Hàng hóa thực tế sẽ xếp vào kho:</span>
                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                      <tr>
                        <th className="p-2 border w-1/4">Sản Phẩm</th>
                        <th className="p-2 border text-center w-1/5">Vị Trí Lưu Hàng</th>
                        <th className="p-2 border text-center w-1/4">Cấu hình Date (NSX - HSD)</th>
                        <th className="p-2 border text-center w-20">Số lượng</th>
                        <th className="p-2 border text-center w-24">Đơn giá (đ)</th>
                        <th className="p-2 border text-right w-24">Thành tiền</th>
                        <th className="p-2 border text-center w-12">Xóa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentChiTietList.map((item, index) => {
                        const currentProduct = allProducts.find(p => String(p.id || p.MaSanPham || p.masanpham) === String(item.MaSP));
                        const productName = currentProduct ? (currentProduct.name || currentProduct.TenSanPham || currentProduct.tensanpham) : `Sản phẩm #${item.MaSP}`;
                        return (
                          <tr key={index} className="hover:bg-gray-50 border-b">
                            <td className="p-2 border font-medium text-gray-700">{productName}</td>
                            <td className="p-2 border text-center">
                              <select className="w-full bg-white border border-gray-200 rounded-lg px-1 py-0.5 text-xs font-bold text-gray-700 focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all" value={item.MaViTriCode} onChange={(e) => handleInlineChange(index, "MaViTriCode", e.target.value)}>
                                {filteredLocations.map((loc) => (
                                  <option key={loc.MaViTriCode || loc.mavitricode} value={loc.MaViTriCode || loc.mavitricode}>
                                    {formatLocationString(loc)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2 border space-y-1">
                              <input type="date" className="border rounded px-1 py-0.5 text-[11px] w-full" value={item.NgaySanXuat || ""} onChange={(e) => handleInlineChange(index, "NgaySanXuat", e.target.value)} />
                              <input type="date" className="border border-amber-200 rounded px-1 py-0.5 text-[11px] w-full text-amber-800" value={item.HanSuDung || ""} onChange={(e) => handleInlineChange(index, "HanSuDung", e.target.value)} />
                            </td>
                            {/* TÌM Ô SỐ LƯỢNG VÀ THAY THÀNH ĐOẠN NÀY: */}
                          <td className="p-2 border text-center">
                            <input 
                              type="number" 
                              className="w-full text-center border rounded py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                              value={item.SoLuong} 
                              onChange={(e) => handleInlineChange(index, "SoLuong", e.target.value)} 
                            />
                          </td>
                            <td className="p-2 border text-center">
                              <input 
                                type="text" 
                                className={`w-full text-center border rounded py-0.5 ${Number(item.DonGia) <= 0 ? 'border-red-500 bg-red-50 text-red-600 font-bold' : ''}`} 
                                value={formatNumberWithDots(item.DonGia)} 
                                onChange={(e) => handleInlineChange(index, "DonGia", parseNumberFromDots(e.target.value))} 
                              />
                            </td>
                            <td className="p-2 border text-right font-bold text-gray-800">{formatCurrency(item.SoLuong * item.DonGia)}</td>
                            <td className="p-2 border text-center">
                              <button type="button" onClick={() => handleRemoveProductRow(index)} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <div className="text-sm font-medium text-gray-700">
                  Tổng tiền: <span className="text-lg font-bold text-blue-600 ml-1">{formatCurrency(calculatedTotal)}</span>
                </div>
                <div className="flex space-x-2">
                  <button type="button" onClick={() => setIsFormModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50">Thoát</button>
                  <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm shadow-sm">Lưu Phiếu Nhập</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 3: THÊM NHANH SẢN PHẨM (HỖ TRỢ THÊM MỚI DANH MỤC & ĐV TÍNH TRỰC TIẾP)
          ========================================================= */}
      {isQuickProductModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden text-[#2D3748]">
            {/* Header Modal */}
            <div className="px-6 py-5 flex justify-between items-center">
              <h3 className="text-xl font-bold text-[#1A202C]">Thêm nhanh hàng hóa</h3>
              <button 
                type="button" 
                onClick={() => setIsQuickProductModalOpen(false)} 
                className="px-4 py-1.5 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Đóng
              </button>
            </div>

            {/* Form Fields Body */}
            <form onSubmit={handleQuickProductSubmit} className="px-6 pb-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {quickProductError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 font-medium">⚠️ {quickProductError}</div>
              )}

              {/* Row 1: Mã sản phẩm & Tên sản phẩm */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mã sản phẩm (Tùy chọn)</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-200 bg-[#F8FAFC] rounded-xl p-3 text-sm focus:outline-none focus:bg-white focus:border-gray-300 placeholder-gray-400" 
                    value={quickProductForm.maSp} 
                    onChange={(e) => setQuickProductForm({...quickProductForm, maSp: e.target.value})} 
                    placeholder="Ví dụ: SP001" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tên sản phẩm <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required
                    className="w-full border border-gray-200 bg-[#F8FAFC] rounded-xl p-3 text-sm focus:outline-none focus:bg-white focus:border-gray-300 placeholder-gray-400" 
                    value={quickProductForm.name} 
                    onChange={(e) => setQuickProductForm({...quickProductForm, name: e.target.value})} 
                    placeholder="Ví dụ: Chuột Gaming Logan" 
                  />
                </div>
              </div>

              {/* Row 2: Danh mục sản phẩm & Đơn vị tính */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SELECT DANH MỤC */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Danh mục sản phẩm <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full border border-gray-200 bg-white rounded-xl p-3 text-sm focus:outline-none focus:border-gray-300 text-gray-700 font-medium cursor-pointer mb-2"
                    value={isCreatingNewCategory ? "__NEW__" : quickProductForm.maDanhMuc}
                    onChange={handleCategorySelectChange}
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {quickCategories.map((cat, index) => (
                      <option key={index} value={cat.id}>{cat.name}</option>
                    ))}
                    <option value="__NEW__" className="text-blue-600 font-bold">+ Tạo danh mục mới...</option>
                  </select>

                  {/* Hiện ô nhập chữ gõ tay nếu chọn Tạo Mới */}
                  {isCreatingNewCategory && (
                    <input 
                      type="text"
                      required
                      className="w-full border-2 border-blue-400 bg-blue-50 rounded-xl p-2.5 text-sm focus:outline-none font-medium placeholder-gray-400 animate-fadeIn"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="✍️ Nhập tên Danh mục mới vào đây..."
                    />
                  )}
                </div>

                {/* SELECT ĐƠN VỊ TÍNH */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Đơn vị tính <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full border border-gray-200 bg-white rounded-xl p-3 text-sm focus:outline-none focus:border-gray-300 text-gray-700 font-medium cursor-pointer mb-2"
                    value={isCreatingNewUnit ? "__NEW__" : quickProductForm.maDonVi}
                    onChange={handleUnitSelectChange}
                  >
                    <option value="">-- Chọn đơn vị tính --</option>
                    {quickUnits.map((unit, index) => (
                      <option key={index} value={unit.id}>{unit.name}</option>
                    ))}
                    <option value="__NEW__" className="text-blue-600 font-bold">+ Tạo đơn vị tính mới...</option>
                  </select>

                  {/* Hiện ô nhập chữ gõ tay nếu chọn Tạo Mới */}
                  {isCreatingNewUnit && (
                    <input 
                      type="text"
                      required
                      className="w-full border-2 border-blue-400 bg-blue-50 rounded-xl p-2.5 text-sm focus:outline-none font-medium placeholder-gray-400 animate-fadeIn"
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                      placeholder="✍️ Nhập Đơn vị tính mới (Cái, Thùng, Hộp...)"
                    />
                  )}
                </div>
              </div>

              {/* Row 3: Mã vạch & Số lượng tối thiểu */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mã vạch (Barcode)</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-200 bg-[#F8FAFC] rounded-xl p-3 text-sm focus:outline-none focus:bg-white focus:border-gray-300 placeholder-gray-400" 
                    value={quickProductForm.barcode} 
                    onChange={(e) => setQuickProductForm({...quickProductForm, barcode: e.target.value})} 
                    placeholder="Nhập chuỗi mã vạch" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Số lượng tối thiểu</label>
                  <input 
                    type="number" 
                    min="0"
                    className="w-full border border-gray-200 bg-[#F8FAFC] rounded-xl p-3 text-sm focus:outline-none focus:bg-white focus:border-gray-300 text-gray-700" 
                    value={quickProductForm.minQuantity} 
                    onChange={(e) => setQuickProductForm({...quickProductForm, minQuantity: e.target.value})} 
                  />
                </div>
              </div>

              {/* Row 4: Số lượng tồn kho ban đầu */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Số lượng tồn kho ban đầu</label>
                  <input 
                    type="number" 
                    min="0"
                    className="w-full border border-gray-200 bg-[#F8FAFC] rounded-xl p-3 text-sm focus:outline-none focus:bg-white focus:border-gray-300 text-gray-700" 
                    value={quickProductForm.soLuongTon} 
                    onChange={(e) => setQuickProductForm({...quickProductForm, soLuongTon: e.target.value})} 
                  />
                </div>
              </div>

              {/* Row 5: Ảnh sản phẩm (URL) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ảnh sản phẩm (URL)</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-200 bg-[#F8FAFC] rounded-xl p-3 text-sm focus:outline-none focus:bg-white focus:border-gray-300 placeholder-gray-400" 
                  value={quickProductForm.imageUrl} 
                  onChange={(e) => setQuickProductForm({...quickProductForm, imageUrl: e.target.value})} 
                  placeholder="https://..." 
                />
              </div>

              {/* Row 6: Mô tả */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mô tả</label>
                <textarea 
                  rows={3} 
                  className="w-full border border-gray-200 bg-[#F8FAFC] rounded-xl p-3 text-sm focus:outline-none focus:bg-white focus:border-gray-300 placeholder-gray-400 resize-none" 
                  value={quickProductForm.description} 
                  onChange={(e) => setQuickProductForm({...quickProductForm, description: e.target.value})} 
                  placeholder="Mô tả ngắn về sản phẩm"
                />
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsQuickProductModalOpen(false)} 
                  className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={isQuickSubmitting}
                  className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors disabled:bg-gray-400"
                >
                  {isQuickSubmitting ? "Đang lưu..." : "Thêm mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: THÊM NHANH NHÀ CUNG CẤP */}
      {isQuickNCCModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3 bg-blue-50 border-b flex justify-between items-center">
              <h4 className="font-bold text-blue-900 text-sm">⚡ Thêm nhanh nhà cung cấp mới</h4>
              <button type="button" onClick={() => setIsQuickNCCModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">&times;</button>
            </div>
            <form onSubmit={handleQuickNCCSubmit} className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase">Mã NCC (Tùy chọn)</label>
                <input
                  type="text"
                  placeholder="Bỏ trống để hệ thống tự tạo"
                  className="w-full border rounded-lg p-2 text-xs font-mono"
                  value={nccFormData.MaNCCCode}
                  onChange={(e) => setNccFormData({ ...nccFormData, MaNCCCode: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase">Tên nhà cung cấp <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tên doanh nghiệp / cá nhân..."
                  className="w-full border rounded-lg p-2 text-xs"
                  value={nccFormData.TenNCC}
                  onChange={(e) => setNccFormData({ ...nccFormData, TenNCC: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase">Người liên hệ</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2 text-xs"
                  value={nccFormData.NguoiLienHe}
                  onChange={(e) => setNccFormData({ ...nccFormData, NguoiLienHe: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase">Số điện thoại</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg p-2 text-xs"
                    value={nccFormData.SDT}
                    onChange={(e) => setNccFormData({ ...nccFormData, SDT: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase">Email</label>
                  <input
                    type="email"
                    className="w-full border rounded-lg p-2 text-xs"
                    value={nccFormData.Email}
                    onChange={(e) => setNccFormData({ ...nccFormData, Email: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button type="button" onClick={() => setIsQuickNCCModalOpen(false)} className="px-3 py-1.5 text-xs bg-gray-100 rounded-md text-gray-600 font-medium">Hủy</button>
                <button type="submit" className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 shadow-sm">Lưu đối tác</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}