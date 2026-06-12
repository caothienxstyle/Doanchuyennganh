import { useEffect, useState, useMemo } from "react";
import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge"; // Import StatusBadge
import { Search, FileText, CheckCircle2, Clock, Plus, Package, XCircle, User, MapPin } from "lucide-react";
import { ROLES, getCurrentRole } from "../services/auth";
import { useNavigate } from "react-router-dom";
import { getTonKhoItems } from "../services/tonKhoService";

export default function ExportPage() {
  const navigate = useNavigate();
  const [phieuXuatList, setPhieuXuatList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [allProducts, setAllProducts] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]); // LƯU DANH SÁCH KHÁCH HÀNG
  const [khoList, setKhoList] = useState([]); // LƯU DANH SÁCH KHO
  const [viTriList, setViTriList] = useState([]); // LƯU DANH SÁCH VỊ TRÍ KHO
  const [tonKhoList, setTonKhoList] = useState([]); // DỮ LIỆU TỒN KHO CHI TIẾT
  const [activatedWarranties, setActivatedWarranties] = useState([]); // Lưu vết phiếu đã kích hoạt BH

  // 🔢 Trạng thái Phân trang & Tìm kiếm
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState("1");

  // Trạng thái Modal chi tiết
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedPhieu, setSelectedPhieu] = useState(null);
  const [chiTietItems, setChiTietItems] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Trạng thái Modal Form (Tạo mới / Sửa phiếu)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); 
  const [formData, setFormData] = useState({
    MaPhieuXuat: "", 
    MaPhieu: "",     
    MaKhachHang: "", // Sẽ lưu MaKH dạng số từ việc lựa chọn danh sách
    MaKho: "1",
    GhiChu: "",
  });

  // ⚡ TRẠNG THÁI MODAL THÊM NHANH KHÁCH HÀNG NGAY TRÊN FORM PX
  const [isQuickCustomerModalOpen, setIsQuickCustomerModalOpen] = useState(false);
  const [customerFormData, setCustomerFormData] = useState({
    MaKHCode: "",
    TenKH: "",
    SDT: "",
    Email: "",
    DiaChi: ""
  });

  const [customerSearchTerm, setCustomerSearchTerm] = useState(""); // 🔍 Tìm kiếm KH trong modal
  const [productSearchTermForTempItem, setProductSearchTermForTempItem] = useState(""); // 🔍 Tìm kiếm SP trong modal
  // Danh sách sản phẩm đang chọn trong Form
  const [currentChiTietList, setCurrentChiTietList] = useState([]);
  const [tempItem, setTempItem] = useState({ 
    MaSP: "", 
    SoLuong: "", 
    DonGia: "", 
    MaViTriCode: ""
  });

  // Helpers định dạng tiền tệ
  const formatNumberWithDots = (val) => String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const parseNumberFromDots = (val) => String(val).replace(/\D/g, "");

  const getToken = () => localStorage.getItem("token") || "";

  // 1. TẢI DANH SÁCH TẤT CẢ PHIẾU XUẤT
  const loadPhieuXuat = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:3000/phieuxuat/danhsach", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        }
      });
      const res = await response.json();
      if (res.success) {
        setPhieuXuatList(res.data || []);
      } else {
        throw new Error(res.message || "Không thể tải danh sách phiếu xuất.");
      }
    } catch (err) {
      setError(err.message || "Lỗi kết nối Server.");
    } finally {
      setLoading(false);
    }
  };

  // 2. TẢI DANH SÁCH SẢN PHẨM 
  const loadProducts = async () => {
    try {
      const response = await fetch("http://localhost:3000/products/danhsachsanpham", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        }
      });
      const res = await response.json();
      if (Array.isArray(res)) setAllProducts(res);
      else if (res && res.success) setAllProducts(res.data || []);
    } catch (err) {
      console.error("Không thể tải danh sách sản phẩm:", err);
    }
  };

  // 3. TẢI DANH SÁCH KHÁCH HÀNG TỪ BACKEND ĐÃ CÓ CỦA BẠN
  const loadCustomers = async () => {
    try {
      const response = await fetch("http://localhost:3000/khachhang/danhsach", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        }
      });
      const res = await response.json();
      if (res.success) {
        setAllCustomers(res.data || []);
      }
    } catch (err) {
      console.error("Không thể tải danh sách đối tác khách hàng:", err);
    }
  };

  // 3.1 TẢI DANH SÁCH KHO
  const loadKhoList = async () => {
    try {
      const response = await fetch("http://localhost:3000/kho/danhsach", {
        method: "GET",
        headers: { "Authorization": `Bearer ${getToken()}` }
      });
      const res = await response.json();
      if (res.success) setKhoList(res.data || []);
    } catch (err) {
      console.error("Lỗi tải danh sách kho:", err);
    }
  };

  // TẢI DANH SÁCH BẢO HÀNH ĐỂ KIỂM TRA TRẠNG THÁI KÍCH HOẠT
  const loadActivatedWarranties = async () => {
    try {
      const response = await fetch("http://localhost:3000/phieubaohanh/danhsach", {
        headers: { "Authorization": `Bearer ${getToken()}` }
      });
      const res = await response.json();
      if (res.success) setActivatedWarranties(res.data || []);
    } catch (err) {
      console.error("Lỗi tải danh sách bảo hành:", err);
    }
  };

  // 3.2 TẢI DANH SÁCH VỊ TRÍ KHO
  const loadViTriList = async () => {
    try {
      const response = await fetch("http://localhost:3000/vitrikho/danhsach", {
        method: "GET",
        headers: { "Authorization": `Bearer ${getToken()}` }
      });
      const res = await response.json();
      if (res.success) setViTriList(res.data || []);
    } catch (err) {
      console.error("Lỗi tải danh sách vị trí kho:", err);
    }
  };

  // 3.3 TẢI DANH SÁCH TỒN KHO THỰC TẾ
  const loadTonKho = async () => {
    try {
      const res = await getTonKhoItems();
      const rawData = res?.data || res || [];
      const normalized = rawData.map(item => {
        const d = item?.data ?? item?.item ?? item ?? {};
        const n = d?.tonKho ?? d?.tonkho ?? {};
        return {
          MaSanPham: String(d.MaSanPham || d.maSanPham || n.MaSanPham || d.id || ""),
          MaKho: String(d.MaKho || n.MaKho || ""),
          MaViTriCode: String(d.MaViTriCode || n.MaViTriCode || d.mavitricode || "").trim(),
          SoLuongTon: Number(d.SoLuongTon ?? n.SoLuongTon ?? d.soLuongTon ?? 0)
        };
      });
      setTonKhoList(normalized);
    } catch (err) {
      console.error("Lỗi tải tồn kho:", err);
    }
  };

  useEffect(() => {
    loadPhieuXuat();
    loadProducts();
    loadCustomers();
    loadKhoList();
    loadViTriList(); // Tải danh sách vị trí kho
    loadTonKho();   // Tải tồn kho chi tiết
    loadActivatedWarranties();
  }, []);

  // Helper để định dạng chuỗi vị trí kho hiển thị
  const formatLocationString = (vt) => {
    if (!vt) return "";
    return vt.TenViTriHienThi ||
      [vt.KhuVuc, vt.DayKe, vt.Tang, vt.OKe].filter(Boolean).join(" / ") ||
      vt.MaViTriCode || "Chưa xác định";
  };

  // � Tự động khôi phục bộ lọc trạng thái từ Dashboard (nếu có)
  useEffect(() => {
    const savedFilter = localStorage.getItem('exportStatusFilter');
    if (savedFilter) {
      setStatusFilter(savedFilter);
      localStorage.removeItem('exportStatusFilter'); // Xóa sau khi dùng để không bị lọc mãi mãi
    }

    const savedDate = localStorage.getItem('exportDateFilter');
    if (savedDate) {
      setDateFilter(savedDate);
      localStorage.removeItem('exportDateFilter');
    }
  }, []);

  // �� Tự động reset trang khi tìm kiếm hoặc lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter, itemsPerPage]);

  // Đồng bộ ô nhập trang
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const filteredLocations = useMemo(() => {
    return viTriList.filter(loc => String(loc.MaKho) === String(formData.MaKho));
  }, [viTriList, formData.MaKho]);

  // 🛡️ LỌC VỊ TRÍ CHỈ HIỂN THỊ NƠI CÓ HÀNG CỦA SẢN PHẨM ĐANG CHỌN
  const selectableLocations = useMemo(() => {
    if (!tempItem.MaSP) return filteredLocations;

    const product = allProducts.find(p => String(p.MaSP || p.code || p.MaSanPhamCode) === String(tempItem.MaSP));
    if (!product) return [];

    const pid = String(product.id || product.MaSanPham || product.masanpham);
    
    // Tìm các vị trí trong kho hiện tại có tồn kho sản phẩm này > 0
    const stockMap = new Set(
      tonKhoList
        .filter(s => s.MaSanPham === pid && s.MaKho === String(formData.MaKho) && s.SoLuongTon > 0)
        .map(s => s.MaViTriCode)
    );

    return filteredLocations.filter(loc => stockMap.has(String(loc.MaViTriCode || loc.mavitricode)));
  }, [tempItem.MaSP, filteredLocations, tonKhoList, allProducts, formData.MaKho]);

  useEffect(() => {
    if (selectableLocations.length > 0) {
      setTempItem((prev) => ({ ...prev, MaViTriCode: selectableLocations[0].MaViTriCode || selectableLocations[0].mavitricode }));
    } else {
      setTempItem((prev) => ({ ...prev, MaViTriCode: "" }));
    }
  }, [selectableLocations]);

  // 🚀 Lọc danh sách khách hàng trong Modal để người dùng chọn nhanh hơn
  const filteredCustomersForModal = useMemo(() => {
    if (!customerSearchTerm.trim()) return allCustomers;
    const s = customerSearchTerm.toLowerCase();
    return allCustomers.filter(cust => 
      String(cust.TenKH || "").toLowerCase().includes(s) ||
      String(cust.MaKHCode || "").toLowerCase().includes(s) ||
      String(cust.SDT || "").toLowerCase().includes(s)
    );
  }, [allCustomers, customerSearchTerm]);

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
    return allProducts.find(p => String(p.MaSP || p.code) === String(tempItem.MaSP));
  }, [tempItem.MaSP, allProducts]);

  // 🔍 LOGIC LỌC DỮ LIỆU THÔNG MINH
  const filteredList = phieuXuatList.filter((phieu) => {
    const search = searchTerm.toLowerCase().trim();
    const matchesSearch = search === "" || 
      String(phieu.MaPhieu || "").toLowerCase().includes(search) ||
      String(phieu.TenKH || "").toLowerCase().includes(search);
    
    const matchesStatus = statusFilter === "" || 
      String(phieu.TrangThai || "").includes(statusFilter);

    const matchesDate = !dateFilter || (phieu.NgayXuat && phieu.NgayXuat.startsWith(dateFilter));

    return matchesSearch && matchesStatus && matchesDate;
  });

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

  // 4. XEM CHI TIẾT SẢN PHẨM CỦA 1 PHIẾU XUẤT
  const handleViewDetail = async (row) => {
    try {
      setSelectedPhieu(row);
      setIsViewModalOpen(true);
      setLoadingDetail(true);

      const response = await fetch(`http://localhost:3000/phieuxuat/chitiet/${row.MaPhieu}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        }
      });
      const res = await response.json();
      if (res.success && res.data) {
        setChiTietItems(res.data.ChiTiet || []);
      } else {
        setChiTietItems([]);
      }
    } catch (err) {
      alert("Không thể tải chi tiết sản phẩm: " + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // 5. KÍCH HOẠT CHẾ ĐỘ SỬA PHIẾU XUẤT
  const handleOpenEdit = async (row) => {
    try {
      setIsEditMode(true);
      setFormData({
        MaPhieuXuat: row.MaPhieuXuat || row.maphieuxuat || row.id || row.MaPhieu, 
        MaPhieu: row.MaPhieu,         
        MaKhachHang: row.MaKH || "", // Đổ đúng mã khách hàng cũ
        MaKho: row.MaKho || "1",
        GhiChu: row.GhiChu || "",
      });

      const response = await fetch(`http://localhost:3000/phieuxuat/chitiet/${row.MaPhieu}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        }
      });
      const res = await response.json();
      
      if (res.success && res.data && res.data.ChiTiet) {
        const mappedChiTiet = res.data.ChiTiet.map(item => {
          const matchedProd = allProducts.find(p => String(p.id || p.MaSanPham || p.masanpham) === String(item.MaSanPham));
          const maThucTe = matchedProd ? (matchedProd.MaSP || matchedProd.MaSanPhamCode) : item.MaPhieuCode || item.MaSPCode || String(item.MaSanPham);

          return {
            MaSP: maThucTe,
            SoLuong: Number(item.SoLuong || 0),
            DonGia: Number(item.DonGia || 0),
            MaViTriCode: String(item.MaViTriCode || item.MaViTri || "") // Đảm bảo là string, không hardcode mặc định
          };
        });
        setCurrentChiTietList(mappedChiTiet);
      } else {
        setCurrentChiTietList([]);
      }

      setIsFormModalOpen(true);
    } catch (err) {
      alert("Không thể tải thông tin chi tiết phiếu để chỉnh sửa: " + err.message);
    }
  };

  const handleInlineChange = (index, field, value) => {
    const updatedList = [...currentChiTietList];
    const stringFields = ["MaViTriCode", "MaSP"];
    
    if (stringFields.includes(field)) {
      updatedList[index] = { ...updatedList[index], [field]: String(value) };
    } else {
      // Đảm bảo ép kiểu số cho SoLuong và DonGia
      updatedList[index] = { ...updatedList[index], [field]: value === "" ? "" : Number(value) };
    }
    setCurrentChiTietList(updatedList);
  };

  // THÊM SẢN PHẨM VÀO BẢNG
  const handleAddProductRow = () => {
    if (!tempItem.MaSP) return alert("Vui lòng chọn một sản phẩm!");
    const qty = Number(tempItem.SoLuong);
    if (!qty || qty <= 0) return alert("Vui lòng nhập số lượng lớn hơn 0!");
    if (tempItem.DonGia === "" || Number(tempItem.DonGia) < 0) return alert("Vui lòng nhập đơn giá!");
    
    if (!tempItem.MaViTriCode) {
      alert("Lỗi: Sản phẩm này không có sẵn tại bất kỳ vị trí nào trong kho đã chọn!");
      return;
    }

    // 🔎 KIỂM TRA TỒN KHO THỰC TẾ TRƯỚC KHI THÊM
    const product = allProducts.find(p => String(p.MaSP || p.code) === String(tempItem.MaSP));
    const pid = String(product?.id || product?.MaSanPham);
    const stock = tonKhoList.find(s => s.MaSanPham === pid && s.MaKho === String(formData.MaKho) && s.MaViTriCode === String(tempItem.MaViTriCode));
    const available = Number(stock?.SoLuongTon || 0);

    const alreadyInTable = currentChiTietList
      .filter(item => String(item.MaSP) === String(tempItem.MaSP) && String(item.MaViTriCode) === String(tempItem.MaViTriCode))
      .reduce((sum, item) => sum + Number(item.SoLuong), 0);

    if (qty > (available - alreadyInTable)) {
      return alert(`Không đủ hàng! Vị trí ${tempItem.MaViTriCode} chỉ còn ${available - alreadyInTable} sản phẩm khả dụng.`);
    }

    const existingIndex = currentChiTietList.findIndex(
      item => String(item.MaSP) === String(tempItem.MaSP) && String(item.MaViTriCode) === String(tempItem.MaViTriCode)
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
          MaSP: String(tempItem.MaSP),
          SoLuong: Number(tempItem.SoLuong),
          DonGia: Number(tempItem.DonGia),
          MaViTriCode: String(tempItem.MaViTriCode)
        }
      ]);
    }
    // Reset form nhưng giữ lại Vị trí mặc định nếu có
    const defaultLoc = selectableLocations.length > 0 ? (selectableLocations[0].MaViTriCode || selectableLocations[0].mavitricode) : "";
    setTempItem({ MaSP: "", SoLuong: "", DonGia: "", MaViTriCode: defaultLoc });
  };

  const handleRemoveProductRow = (index) => {
    setCurrentChiTietList(currentChiTietList.filter((_, i) => i !== index));
  };

  const calculatedTotal = currentChiTietList.reduce((sum, item) => sum + (item.SoLuong * item.DonGia), 0);

  // 6. MỞ MODAL TẠO MỚI PHIẾU XUẤT
  const handleOpenCreate = () => {
    setIsEditMode(false);
    setFormData({
      MaPhieuXuat: "", 
      MaPhieu: `PX${Date.now().toString().slice(-6)}`, 
      MaKhachHang: "", 
      MaKho: "1",
      GhiChu: "",
    });
    setCurrentChiTietList([]); 
    setCustomerSearchTerm(""); // Reset tìm kiếm KH
    setIsFormModalOpen(true);
  };

  // 7. XỬ LÝ LƯU KHÁCH HÀNG TẠO NHANH LÊN SERVER
  const handleQuickSubmitCustomer = async (e) => {
    e.preventDefault();
    if (!customerFormData.TenKH.trim()) {
      alert("Tên khách hàng bắt buộc phải điền!");
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/khachhang/taokhachhang", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        },
        body: JSON.stringify(customerFormData)
      });
      const res = await response.json();
      if (res.success) {
        alert("Khởi tạo đối tác khách hàng thành công!");
        
        // Load lại danh sách khách hàng mới nhất từ database
        const responseReload = await fetch("http://localhost:3000/khachhang/danhsach", {
          method: "GET",
          headers: { "Authorization": `Bearer ${getToken()}` }
        });
        const resReload = await responseReload.json();
        
        if (resReload.success && resReload.data) {
          setAllCustomers(resReload.data);
          
          // Tự động tìm khách hàng vừa tạo dựa trên mã code hoặc tên để gán luôn vào phiếu xuất đang viết dở
          const codeVuaTao = res.code || customerFormData.MaKHCode;
          const foundVuaTao = resReload.data.find(c => c.MaKHCode === codeVuaTao || c.TenKH === customerFormData.TenKH);
          if (foundVuaTao) {
            setFormData(prev => ({ ...prev, MaKhachHang: foundVuaTao.MaKH }));
          }
        }
        
        setIsQuickCustomerModalOpen(false); // Đóng modal phụ tạo nhanh khách hàng
      } else {
        alert("Lỗi: " + res.message);
      }
    } catch (err) {
      alert("Lỗi kết nối tạo khách hàng: " + err.message);
    }
  };

  // 8. GỬI PHIẾU XUẤT LÊN BACKEND
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.MaKhachHang) {
      alert("Vui lòng chọn hoặc thêm mới một đối tác khách hàng!");
      return;
    }
    if (currentChiTietList.length === 0) {
      alert("Phiếu xuất phải có ít nhất 1 mặt hàng!");
      return;
    }

    const hasInvalidItem = currentChiTietList.some(item => item.SoLuong <= 0 || item.DonGia < 0 || !item.MaViTriCode);
    if (hasInvalidItem) {
      alert("Vui lòng kiểm tra lại bảng: Số lượng > 0, giá không âm và mọi mặt hàng đều phải chọn vị trí!");
      return;
    }

    try {
      const payload = {
        MaPhieuXuat: isEditMode ? Number(formData.MaPhieuXuat) : undefined,
        MaPhieu: formData.MaPhieu, 
        MaKhachHang: Number(formData.MaKhachHang),
        MaKho: Number(formData.MaKho || 1),
        TongTien: calculatedTotal,
        GhiChu: formData.GhiChu,
        ChiTiet: currentChiTietList.map(item => {
          const matchedProd = allProducts.find(p => String(p.MaSP || p.MaSanPhamCode) === String(item.MaSP));
          const idHeThong = matchedProd ? (matchedProd.id || matchedProd.MaSanPham || matchedProd.masanpham) : item.MaSP;
          
          return {
            MaSanPham: idHeThong, 
            SoLuong: Number(item.SoLuong),
            DonGia: Number(item.DonGia),
            MaViTriCode: String(item.MaViTriCode).trim()
          };
        })
      };

      const url = isEditMode
        ? `http://localhost:3000/phieuxuat/capnhatphieuxuat`
        : "http://localhost:3000/phieuxuat/taophieuxuat";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        },
        body: JSON.stringify(payload)
      });

      const res = await response.json();
      if (res.success) {
        alert(res.message || (isEditMode ? "Cập nhật phiếu xuất thành công!" : "Tạo phiếu xuất kho thành công!"));
        setIsFormModalOpen(false);
        await loadPhieuXuat();
      } else {
        alert("Lỗi hệ thống Backend trả về:\n👉 " + res.message);
      }
    } catch (err) {
      alert(`Lỗi hệ thống: ${err.message}`);
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

  return (
    <MainLayout>
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Quản lý Phiếu Xuất Kho</h2>
          <p className="text-sm text-gray-400 mt-1">Cấp phát, xuất trả và theo dõi lịch sử vận chuyển vật tư</p>
        </div>
        <button onClick={handleOpenCreate} className="rounded-xl bg-blue-600 px-5 py-2.5 text-white text-sm hover:bg-blue-700 font-bold transition-all shadow-md flex items-center gap-2">
          <FileText size={18}/> + Tạo phiếu xuất mới
        </button>
      </div>

      {/* KPI STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div 
          onClick={() => setStatusFilter("")}
          className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${statusFilter === "" ? "border-blue-500 ring-2 ring-blue-500/10 shadow-md" : "border-gray-100 hover:border-blue-200"}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${statusFilter === "" ? "bg-blue-600 text-white font-bold text-lg" : "bg-blue-50 text-blue-600 font-bold text-lg"}`}>📦</div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Tổng xuất kho</p>
            <h3 className="text-xl font-bold text-gray-800">{phieuXuatList.length} <span className="text-xs font-normal text-gray-400">Phiếu</span></h3>
          </div>
        </div>
        <div 
          onClick={() => setStatusFilter("DaDuyet")}
          className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${statusFilter === "DaDuyet" ? "border-green-500 ring-2 ring-green-500/10 shadow-md" : "border-gray-100 hover:border-green-200"}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${statusFilter === "DaDuyet" ? "bg-green-600 text-white" : "bg-green-50 text-green-600"}`}>
            <CheckCircle2 size={20}/>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Đã hoàn tất</p>
            <h3 className="text-xl font-bold text-green-600">{phieuXuatList.filter(p => String(p.TrangThai).includes("Duyet") && !String(p.TrangThai).includes("Cho")).length}</h3>
          </div>
        </div>
        <div 
          onClick={() => setStatusFilter("ChoDuyet")}
          className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${statusFilter === "ChoDuyet" ? "border-amber-500 ring-2 ring-amber-500/10 shadow-md" : "border-gray-100 hover:border-amber-200"}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${statusFilter === "ChoDuyet" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-600"}`}>
            <Clock size={20}/>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Đang chờ duyệt</p>
            <h3 className="text-xl font-bold text-amber-600">{phieuXuatList.filter(p => String(p.TrangThai).includes("Cho")).length}</h3>
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
                placeholder="Nhập mã phiếu, tên đối tác khách hàng..."
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
              <option value="DaDuyet">Đã xuất kho</option>
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

      {loading && <div className="flex items-center justify-center p-12 text-gray-400 animate-pulse">⏳ Đang đồng bộ hồ sơ phiếu xuất...</div>}
      {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 mb-6 text-sm">⚠️ {error}</div>}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <DataTable
          columns={[
            { key: "MaPhieu", label: "Mã phiếu" },
            { 
              key: "TenKH", 
              label: "Khách hàng", 
              render: (value, row) => value || `Mã khách: ${row.MaKH || "—"}` 
            },
            { 
              key: "NgayXuat", 
              label: "Ngày xuất", 
              render: (v) => v ? new Date(v).toLocaleString("vi-VN") : "—" 
            },
            { 
              key: "TongTien", 
              label: "Tổng tiền", 
              render: (v, row) => formatCurrency(v || row.TongTien || row.tongtien || 0) 
            },
            { 
              key: "TrangThai", 
              label: "Trạng thái", 
              render: (v) => <StatusBadge status={v === "ChoDuyet" ? "Chờ duyệt" : v === "DaDuyet" ? "Đã duyệt" : v} /> 
            },
            {
              key: "warranty",
              label: "Bảo hành",
              render: (_, row) => {
                const isActivated = activatedWarranties.some(w => String(w.MaPhieuGoc) === String(row.MaPhieu));
                if (isActivated) return <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-1 rounded border border-emerald-100">Đã kích hoạt</span>;
                // Chỉ cho phép kích hoạt khi phiếu đã được duyệt nhập/xuất kho
                if (row.TrangThai === "DaDuyet" || row.TrangThai === "Đã duyệt") 
                  return <button onClick={() => navigate("/PhieuBaoHanh", { state: { maPhieu: row.MaPhieu, type: "EXPORT" } })} className="text-blue-600 hover:underline text-[10px] font-bold">Kích hoạt BH</button>;
                return <span className="text-gray-300 text-[10px] italic">Chưa duyệt</span>;
              }
            },
            {
              key: "actions",
              label: "Hành động",
              render: (_, row) => (
                <div className="flex space-x-2 items-center">
                  <button onClick={() => handleViewDetail(row)} className="text-blue-600 hover:text-blue-800 text-xs bg-blue-50 px-2 py-1 rounded font-medium">
                    Xem sản phẩm
                  </button>
                  
                  {(row.TrangThai === "ChoDuyet" || row.TrangThai === "Chờ duyệt") && (
                    <button onClick={() => handleOpenEdit(row)} className="text-amber-600 hover:text-amber-800 text-xs bg-amber-50 px-2 py-1 rounded font-medium">
                      Sửa phiếu
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          data={paginatedList}
        />
        {filteredList.length === 0 && (
          <div className="p-12 text-center text-gray-400 text-sm">📭 Không tìm thấy kết quả phiếu xuất phù hợp.</div>
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

      {/* 1. MODAL XEM CHI TIẾT */}
      {isViewModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Mặt hàng xuất của phiếu: {selectedPhieu?.MaPhieu}</h3>
              <button onClick={() => setIsViewModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>
            <div className="p-6">
              {loadingDetail ? <p className="text-sm text-gray-500">Đang tải...</p> : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 text-xs uppercase font-semibold">
                      <th className="p-2 border">Mã SP</th>
                      <th className="p-2 border">Tên Sản Phẩm</th>
                      <th className="p-2 border text-center">Số lượng</th>
                      <th className="p-2 border text-right">Đơn giá xuất</th>
                      <th className="p-2 border text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chiTietItems.map((item, index) => {
                      // Tìm kiếm thông tin sản phẩm đầy đủ dựa trên ID hệ thống
                      const productInfo = allProducts.find(p => String(p.id || p.MaSanPham || p.masanpham) === String(item.MaSanPham || item.masanpham));
                      const maSP = productInfo?.MaSP || productInfo?.code || item.MaPhieuCode || item.MaSPCode || item.MaSanPham || "—";
                      const tenSP = item.TenSanPham || productInfo?.name || productInfo?.TenSanPham || `Sản phẩm mã #${maSP}`;

                      return (
                        <tr key={index} className="hover:bg-gray-50 border-b">
                          <td className="p-2 border text-xs font-mono font-bold text-indigo-600">
                            {maSP}
                          </td>
                          <td className="p-2 border font-medium text-gray-700">{tenSP}</td>
                          <td className="p-2 border text-center text-red-600 font-semibold">{item.SoLuong}</td>
                          <td className="p-2 border text-right">{formatCurrency(item.DonGia)}</td>
                          <td className="p-2 border text-right font-bold text-gray-800">{formatCurrency(item.SoLuong * item.DonGia)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <div className="mt-4 text-right font-bold text-base text-red-600">
                Tổng giá trị xuất kho: {formatCurrency(selectedPhieu?.TongTien || 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL FORM TẠO/SỬA PHIẾU XUẤT */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">
                {isEditMode ? `Chỉnh Sửa Phiếu Xuất Kho (Mã hiển thị: ${formData.MaPhieu})` : "Tạo Phiếu Xuất Kho Mới"}
              </h3>
              <button onClick={() => setIsFormModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">MÃ SỐ PHIẾU</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full border rounded-lg p-2 text-sm font-mono font-bold bg-white" 
                    value={formData.MaPhieu} 
                    onChange={(e) => setFormData({ ...formData, MaPhieu: e.target.value })} 
                  />
                </div>

                {/* 🌟 ĐÃ ĐỔI: Ô CHỌN KHÁCH HÀNG THÔNG MINH + CÓ NÚT TẠO NHANH */}
                <div className="relative">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-gray-700">KHÁCH HÀNG</label>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerFormData({ MaKHCode: "", TenKH: "", SDT: "", Email: "", DiaChi: "" });
                        setIsQuickCustomerModalOpen(true);
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:underline"
                    >
                      ⚡ Tạo mới KH
                    </button>
                  </div>
                  <select
                    className="hidden" // Ẩn select gốc
                    value={formData.MaKhachHang} // Vẫn giữ giá trị
                    onChange={(e) => setFormData({ ...formData, MaKhachHang: e.target.value })} // Vẫn xử lý thay đổi
                  ></select>
                  {/* 🚀 AUTCOMPLETE CHO KHÁCH HÀNG */}
                  {!formData.MaKhachHang ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="text"
                          autoFocus
                          placeholder="Gõ tên hoặc mã KH để tìm nhanh..."
                          className="w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm outline-none focus:border-blue-500 bg-white shadow-sm transition-all"
                          value={customerSearchTerm}
                          onChange={(e) => setCustomerSearchTerm(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && filteredCustomersForModal.length > 0) {
                              e.preventDefault();
                              const cust = filteredCustomersForModal[0];
                              setFormData({ ...formData, MaKhachHang: cust.MaKH });
                              setCustomerSearchTerm("");
                            }
                          }}
                        />
                      </div>
                      <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-xl bg-gray-50/50 divide-y divide-gray-100 scrollbar-thin shadow-inner">
                        {filteredCustomersForModal.length > 0 ? (
                          filteredCustomersForModal.slice(0, 50).map((cust) => (
                            <div 
                              key={cust.MaKH}
                              onClick={() => {
                                setFormData({ ...formData, MaKhachHang: cust.MaKH });
                                setCustomerSearchTerm("");
                              }}
                              className="p-3 hover:bg-blue-50 cursor-pointer transition-all flex items-center justify-between group"
                            >
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-700 group-hover:text-blue-700">{cust.TenKH}</span>
                                <span className="text-[10px] text-gray-400 font-mono mt-0.5">Mã KH: {cust.MaKHCode || cust.MaKH}</span>
                              </div>
                              <Plus size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-gray-400 italic">Không tìm thấy khách hàng nào...</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 border-2 border-blue-100 bg-blue-50/50 rounded-2xl animate-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
                          <User size={18} />
                        </div>
                        <div>
                          {(() => {
                            const c = allCustomers.find(cust => String(cust.MaKH) === String(formData.MaKhachHang));
                            return (
                              <>
                                <p className="text-xs font-black text-blue-900">{c?.TenKH || c?.name || "Khách hàng đã chọn"}</p>
                                <p className="text-[10px] font-bold text-blue-500 font-mono uppercase">Mã KH: {c?.MaKHCode || c?.code || "---"}</p>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setFormData({ ...formData, MaKhachHang: "" })}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
                      >
                        <XCircle size={18} />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">KHO XUẤT HÀNG</label>
                  <select 
                    required 
                    className="w-full border rounded-lg p-2 text-sm bg-white font-medium text-gray-700 focus:ring-2 focus:ring-blue-500" 
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Ghi chú xuất kho</label>
                <input type="text" className="w-full border rounded-lg p-2 text-sm" value={formData.GhiChu} onChange={(e) => setFormData({ ...formData, GhiChu: e.target.value })} placeholder="Lý do xuất kho..." />
              </div>

              <hr />

              {/* Bộ thêm sản phẩm nhanh */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-4 shadow-sm relative z-40">
                <div className="flex items-center gap-2 mb-1 border-b border-gray-100 pb-2">
                  <div className="p-1 bg-blue-100 rounded text-blue-600"><Package size={14}/></div>
                  <span className="text-xs font-black text-gray-800 uppercase tracking-tight">Chọn hàng xuất kho</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Chọn Sản phẩm</label>
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
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && filteredProductsForTempItem.length > 0) {
                                e.preventDefault();
                                const p = filteredProductsForTempItem[0];
                                setTempItem({ ...tempItem, MaSP: p.MaSP || p.code });
                                setProductSearchTermForTempItem("");
                              }
                            }}
                          />
                        </div>
                        <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-xl bg-gray-50/50 divide-y divide-gray-100 scrollbar-thin shadow-inner">
                          {filteredProductsForTempItem.length > 0 ? (
                            filteredProductsForTempItem.slice(0, 50).map((p) => (
                              <div 
                                key={p.id || p.MaSanPham}
                                onClick={() => {
                                  setTempItem({ ...tempItem, MaSP: p.MaSP || p.code });
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
                            {getSelectedProductInfo?.name || getSelectedProductInfo?.TenSanPham || "Sản phẩm đã chọn"}
                          </p>
                          <p className="text-[10px] font-bold text-blue-500 font-mono uppercase">
                            Mã SP: {getSelectedProductInfo?.code || getSelectedProductInfo?.MaSP || "---"}
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
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Vị trí lấy hàng</label>
                    <select
                      className="w-full border border-gray-200 rounded-xl p-2 text-sm bg-white font-bold text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                      value={tempItem.MaViTriCode}
                      onChange={(e) => setTempItem({ ...tempItem, MaViTriCode: e.target.value })}
                    >
                      <option value="">-- Chọn vị trí --</option>
                      {selectableLocations.length === 0 && <option value="">❌ Không có hàng trong kho này</option>}
                      {selectableLocations.map(loc => (
                        <option key={loc.MaViTriCode || loc.mavitricode} value={loc.MaViTriCode || loc.mavitricode}>{formatLocationString(loc)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Số lượng</label>
                    <input  className="w-full border border-gray-200 rounded-xl p-2 text-sm bg-white font-bold text-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-center" value={tempItem.SoLuong} onChange={(e) => setTempItem({ ...tempItem, SoLuong: e.target.value })} placeholder="0" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Đơn giá (đ)</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 rounded-xl p-2 text-sm bg-white font-bold text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-right" 
                      value={formatNumberWithDots(tempItem.DonGia)} 
                      onChange={(e) => setTempItem({ ...tempItem, DonGia: parseNumberFromDots(e.target.value) })} 
                      placeholder="0" 
                    />
                  </div>
                  <div className="md:col-span-1 self-end">
                    <button type="button" onClick={handleAddProductRow} className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg flex items-center justify-center transition-all active:scale-90 shadow-blue-200/50">
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              </div>

              {/* BẢNG SỬA INLINE */}
              <div>
                <table className="w-full text-left text-xs border border-gray-200">
                  <thead className="bg-gray-50 text-gray-600 font-semibold">
                    <tr>
                      <th className="p-2 border">Mã Sản Phẩm</th>
                      <th className="p-2 border text-center">Vị trí xuất</th>
                      <th className="p-2 border text-center w-20">Số lượng</th>
                      <th className="p-2 border text-center w-28">Giá xuất (đ)</th>
                      <th className="p-2 border text-right">Thành tiền</th>
                      <th className="p-2 border text-center w-16">Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentChiTietList.map((item, index) => {
                      const currentProduct = allProducts.find(p => String(p.MaSP || p.MaSanPhamCode) === String(item.MaSP));
                      const tenSPHienThi = currentProduct ? (currentProduct.TenSanPham || currentProduct.tensanpham) : "";

                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-2 border font-mono">
                            <span className="font-bold text-indigo-600">{item.MaSP}</span>
                            {tenSPHienThi && <span className="block text-[10px] text-gray-600 truncate font-sans">{tenSPHienThi}</span>}
                          </td>
                          <td className="p-2 border text-center">
                            <select
                              className="w-full border rounded px-1 py-1 text-xs bg-white"
                              value={item.MaViTriCode}
                              onChange={(e) => handleInlineChange(index, "MaViTriCode", e.target.value)}
                              required
                            >
                              {filteredLocations.length === 0 && <option value="">❌ Kho chưa cấu hình vị trí</option>}
                              {filteredLocations.map(loc => (
                                <option key={loc.MaViTriCode || loc.mavitricode} value={loc.MaViTriCode || loc.mavitricode}>{formatLocationString(loc)}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 border text-center">
                            <input 
                              type="number" 
                              min="1" 
                              className="w-full border rounded px-1.5 py-1 text-center font-semibold text-red-600 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={item.SoLuong} 
                              onChange={(e) => handleInlineChange(index, "SoLuong", e.target.value)} 
                            />
                          </td>
                          <td className="p-2 border text-center">
                            <input 
                              type="number" 
                              min="0" 
                              className="w-full border rounded px-1.5 py-1 text-right bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={item.DonGia} 
                              onChange={(e) => handleInlineChange(index, "DonGia", e.target.value)} 
                            />
                          </td>
                          <td className="p-2 border text-right font-bold text-gray-700">
                            {formatCurrency(Number(item.SoLuong || 0) * Number(item.DonGia || 0))}
                          </td>
                          <td className="p-2 border text-center">
                            <button type="button" onClick={() => handleRemoveProductRow(index)} className="text-red-500 hover:text-red-700 font-bold">Xóa</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-gray-700">
                  Tổng tiền xuất kho: <span className="font-bold text-lg text-red-600">{formatCurrency(calculatedTotal)}</span>
                </div>
                <div className="flex space-x-2">
                  <button type="button" onClick={() => setIsFormModalOpen(false)} className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Hủy</button>
                  <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md">
                    {isEditMode ? "Cập Nhật Phiếu" : "Lưu & Tạo Phiếu"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 3. MODAL PHỤ: ĐIỀN THÔNG TIN TẠO NHANH KHÁCH HÀNG */}
      {isQuickCustomerModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="px-5 py-3 bg-blue-50 border-b flex justify-between items-center">
              <h4 className="font-bold text-blue-900 text-sm">⚡ Thêm nhanh khách hàng mới</h4>
              <button type="button" onClick={() => setIsQuickCustomerModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">&times;</button>
            </div>
            <form onSubmit={handleQuickSubmitCustomer} className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">MÃ KHÁCH HÀNG (TÙY CHỌN)</label>
                <input
                  type="text"
                  placeholder="Bỏ trống hệ thống tự tạo ngẫu nhiên"
                  className="w-full border rounded-lg p-2 text-xs font-mono bg-white"
                  value={customerFormData.MaKHCode}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, MaKHCode: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">TÊN ĐỐI TÁC KHÁCH HÀNG <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tên doanh nghiệp / cá nhân..."
                  className="w-full border rounded-lg p-2 text-xs"
                  value={customerFormData.TenKH}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, TenKH: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">SỐ ĐIỆN THOẠI</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg p-2 text-xs"
                    value={customerFormData.SDT}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, SDT: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">EMAIL</label>
                  <input
                    type="email"
                    className="w-full border rounded-lg p-2 text-xs"
                    value={customerFormData.Email}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, Email: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">ĐỊA CHỈ GIAO HÀNG</label>
                <textarea
                  rows="2"
                  className="w-full border rounded-lg p-2 text-xs"
                  value={customerFormData.DiaChi || ""}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, DiaChi: e.target.value })}
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button type="button" onClick={() => setIsQuickCustomerModalOpen(false)} className="px-3 py-1.5 text-xs bg-gray-100 rounded-md text-gray-600">Đóng</button>
                <button type="submit" className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700">Lưu khách hàng</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}