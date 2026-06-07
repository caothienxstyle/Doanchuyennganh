import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { CheckCircle, XCircle, Loader2, ArrowRight, Warehouse, MapPin, Edit3, Search, PlusCircle, User, ShieldAlert, Calendar, Users, Truck, Clock, AlertTriangle, Send, Archive, RefreshCw, FileCheck, ListChecks, Package, ExternalLink, FileInput, FileOutput } from "lucide-react";
import DataTable from "../components/DataTable"; 
import MainLayout from "../layouts/MainLayout";

export default function BaoHanhPage() {
  // --- Các State quản lý dữ liệu ---
  const [activeTab, setActiveTab] = useState("EXPORT"); // "EXPORT" | "IMPORT"
  const [activeKpiFilter, setActiveKpiFilter] = useState(""); // 🌟 Lọc trạng thái từ thẻ KPI

  // 🔢 Trạng thái Phân trang & Tiện ích
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState("1");

  const [danhSachPhieu, setDanhSachPhieu] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState(""); // 🌟 Thêm tìm kiếm theo mã phiếu
  const [selectedIds, setSelectedIds] = useState([]); // Quản lý chọn nhiều ở Tab NCC

  // --- State quản lý Modal & Form cập nhật ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPhieu, setSelectedPhieu] = useState(null);

  // --- 🌟 State mới cho quản lý hồ sơ theo nhóm ---
  const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
  const [selectedSlipGroup, setSelectedSlipGroup] = useState(null);
  const [itemsInSlip, setItemsInSlip] = useState([]); // 🌟 Lưu danh sách máy lẻ của phiếu đang xem
  const [allProducts, setAllProducts] = useState([]); // 🌟 State lưu danh mục sản phẩm để tra cứu tên

  // --- State cho Modal Tiếp nhận mới ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkResult, setCheckResult] = useState(null); 
  const [isChecking, setIsChecking] = useState(false);
  const [serialInput, setSerialInput] = useState(""); 
  
  // Data cho các dropdown hệ thống
  const [danhSachKho, setDanhSachKho] = useState([]);
  const [danhSachViTriSua, setDanhSachViTriSua] = useState([]); // State riêng cho Modal Sửa
  const [danhSachViTriTao, setDanhSachViTriTao] = useState([]); // State riêng cho Modal Tạo
  const [loadingViTriSua, setLoadingViTriSua] = useState(false);
  const [loadingViTriTao, setLoadingViTriTao] = useState(false);

  // Form submit trạng thái bảo hành (Modal cập nhật)
  const [formState, setFormState] = useState({
    TrangThaiMoi: "",
    HuongXuLy: "",
    GhiChu: "",
    MaKho: "",
    MaViTri: "",
    MaPhieu: "",
    NgayGuiNCC: "",
    NgayHenTraNCC: "",
    SoLuong: 1 // 🌟 Bổ sung: Sử dụng SoLuong thay cho SoSanPham để đồng bộ BE
  });

  // Form cho tạo mới phiếu bảo hành (Modal tiếp nhận)
  const [newBaoHanh, setNewBaoHanh] = useState({
    MaSanPham: "",
    MaKho: "1",
    MaNCC: "1",
    MaViTri: "",
    MaPhieu: "",
    TinhTrangLoi: "",
    LoaiBaoHanh: "Sửa chữa",
    TrangThai: "ChoBaoHanh",
    SoLuong: 1, // 🌟 Bổ sung: Mặc định số lượng là 1 khi tiếp nhận mới
    HanBaoHanhNCC: null // Lưu trữ hạn bảo hành từ NCC để đối soát
  });

  const getToken = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
  const headers = { Authorization: `Bearer ${getToken()}` };

  // Hàm định dạng ngày tháng linh hoạt
  const formatDate = (val) => {
    if (!val || String(val).startsWith("0001") || String(val).startsWith("1900") || val === "null") return "—";
    const d = new Date(val);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN");
  };
  // ==========================================
  // 1. LOAD DANH SÁCH PHIẾU BẢO HÀNH & KHO
  // ==========================================
  const loadDataBaoHanh = async () => {
    try {
      setLoading(true);
      setError("");
      // 🌟 FIX: Đảm bảo không khai báo 'res' hay các biến khác trùng tên trước đó
      const [resBH, resK, resP] = await Promise.all([
        axios.get("http://localhost:3000/phieubaohanh/danhsach", { headers }),
        axios.get("http://localhost:3000/kho/danhsach", { headers }),
        axios.get("http://localhost:3000/products/danhsachsanpham", { headers })
      ]);
      setDanhSachPhieu(resBH.data?.data || resBH.data || []);
      setDanhSachKho(resK.data?.data || resK.data || []);
      setAllProducts(Array.isArray(resP.data) ? resP.data : (resP.data.data || []));
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải dữ liệu bảo hành.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataBaoHanh();
  }, []);

  // 🔄 Tự động reset trang khi tìm kiếm hoặc lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, activeKpiFilter, itemsPerPage]);

  // Đồng bộ ô nhập trang nhanh
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // ==========================================
  // 🌟 FIX LỖI: TÁCH BIỆT LOGIC TẢI VỊ TRÍ CHO TỪNG MODAL
  // Tránh xung đột dữ liệu khi đóng/mở hoặc chuyển đổi Modal
  // ==========================================

  // Tải vị trí cho Modal Sửa
  useEffect(() => {
    if (!isModalOpen || !formState.MaKho) {
      setDanhSachViTriSua([]);
      return;
    }
    const loadViTriSua = async () => {
      try {
        setLoadingViTriSua(true);
        const res = await axios.get(`http://localhost:3000/vitrikho/danhsach?maKho=${formState.MaKho}`, { headers });
        setDanhSachViTriSua(res.data?.data || res.data || []);
      } catch (err) { console.error("Lỗi tải vị trí sửa:", err); } 
      finally { setLoadingViTriSua(false); }
    };
    loadViTriSua();
  }, [formState.MaKho, isModalOpen]);

  // Tải vị trí cho Modal Tiếp nhận mới
  useEffect(() => {
    if (!isCreateModalOpen || !newBaoHanh.MaKho) {
      setDanhSachViTriTao([]);
      return;
    }
    const loadViTriTao = async () => {
      try {
        setLoadingViTriTao(true);
        const res = await axios.get(`http://localhost:3000/vitrikho/danhsach?maKho=${newBaoHanh.MaKho}`, { headers });
        setDanhSachViTriTao(res.data?.data || res.data || []);
      } catch (err) { console.error("Lỗi tải vị trí tạo:", err); }
      finally { setLoadingViTriTao(false); }
    };
    loadViTriTao();
  }, [newBaoHanh.MaKho, isCreateModalOpen]);

  // MỞ MODAL XỬ LÝ PHIẾU
  const handleOpenEditModal = (phieu) => {
    setSelectedPhieu(phieu);
    setFormState({
      TrangThaiMoi: phieu.TrangThai, 
      HuongXuLy: phieu.HuongXuLy || "",
      GhiChu: phieu.GhiChu || "",
      MaKho: phieu.MaKho ? String(phieu.MaKho) : "", 
      MaViTri: phieu.MaViTri ? String(phieu.MaViTri) : "", 
      // Ưu tiên các trường hiển thị chuẩn từ BE
      MaPhieu: phieu.MaGoc || phieu.MaPhieuXuatHienThi || phieu.MaPhieuNhapHienThi || phieu.MaPhieu || "",
      NgayGuiNCC: phieu.NgayGuiNCC ? phieu.NgayGuiNCC.split("T")[0] : "",
      NgayHenTraNCC: phieu.NgayHenTraNCC ? phieu.NgayHenTraNCC.split("T")[0] : "",
      SoLuong: phieu.SoLuong || 1 // Load số lượng hiện tại từ database
    });
    setIsModalOpen(true);
  };

  // ==========================================
  // 🌟 FIX LỖI 1: BỔ SUNG ĐẦY ĐỦ KHHO / VỊ TRÍ VÀO PAYLOAD GỬI ĐI
  // ==========================================
  const handleSubmitTrangThai = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        TrangThai: formState.TrangThaiMoi,
        // 🌟 Gửi đúng ID số theo hướng dẫn BE
        MaPhieuXuat: selectedPhieu.MaPhieuXuat || null,
        MaPhieuNhap: selectedPhieu.MaPhieuNhap || null,
        MaKho: formState.MaKho ? Number(formState.MaKho) : null,      // Đã sửa bổ sung
        MaViTri: formState.MaViTri ? Number(formState.MaViTri) : null,  // Đã sửa bổ sung
        NgayGuiNCC: formState.NgayGuiNCC || null,
        NgayHenTraNCC: formState.NgayHenTraNCC || null,
        SoLuong: Number(formState.SoLuong || 1) // 🌟 Gửi đúng key SoLuong kiểu Int theo BE yêu cầu
      };
      if (formState.HuongXuLy.trim()) payload.HuongXuLy = formState.HuongXuLy;
      if (formState.GhiChu.trim()) payload.GhiChu = formState.GhiChu;

      await axios.patch(`http://localhost:3000/baohanh/trangthai/${selectedPhieu.MaBaoHanh}`, payload, { headers });
      
      setIsModalOpen(false);
      loadDataBaoHanh(); 
    } catch (err) {
      alert(err.response?.data?.message || "Cập nhật trạng thái thất bại");
    }
  };

  // TIẾP NHẬN BẢO HÀNH (LUỒNG 2 BƯỚC)
  const handleCheckWarranty = async () => {
    if (!searchQuery.trim()) return;
    try {
      setIsChecking(true);
      setCheckResult(null);
      // 🌟 Cập nhật Endpoint tra cứu mới theo tài liệu BE
      const res = await axios.get(`http://localhost:3000/baohanh/kiemtra?search=${searchQuery}`, { headers });
      if (res.data.success && res.data.data) {
        const info = res.data.data;
        setCheckResult(info);
        
        // 🌟 FIX LỖI 1: Bóc tách MaSanPham kỹ hơn để tránh lỗi rỗng khi submit
        const productId = info.MaSanPham || info.idSanPham || info.id || "";

        setNewBaoHanh(prev => ({
          ...prev,
          MaPhieu: info.MaPhieu, // Đây là mã hiển thị (VD: PX123)
          MaPhieuXuat: info.MaPhieuXuat || null,
          MaPhieuNhap: info.MaPhieuNhap || null,
          MaSanPham: productId || prev.MaSanPham,
          HanBaoHanhNCC: info.DoiSoatNhaCungCap?.HanBaoHanhNCC || null
        }));
      } else {
        alert("Không tìm thấy thông tin bảo hành cho mã này.");
      }
    } catch (err) {
      alert("Lỗi kiểm tra: " + (err.response?.data?.message || "Không tìm thấy dữ liệu"));
    } finally {
      setIsChecking(false);
    }
  };

  const handleCreateBaoHanh = async (e) => {
    e.preventDefault();
    if (!newBaoHanh.MaSanPham) {
      return alert("Lỗi: Không xác định được ID sản phẩm. Vui lòng kiểm tra lại bước 1.");
    }

    try {
      const danhSachSerial = serialInput.split("\n").map(s => s.trim()).filter(s => s !== "");
      
      const payload = {
        ...newBaoHanh,
        MaKho: Number(newBaoHanh.MaKho || 1),
        MaViTri: newBaoHanh.MaViTri ? Number(newBaoHanh.MaViTri) : undefined,
        MaPhieuXuat: newBaoHanh.MaPhieuXuat ? Number(newBaoHanh.MaPhieuXuat) : undefined,
        MaPhieuNhap: newBaoHanh.MaPhieuNhap ? Number(newBaoHanh.MaPhieuNhap) : undefined,
        SoLuong: Number(newBaoHanh.SoLuong || 1),
        // 🌟 Bổ sung trường HanBaoHanh (hạn NCC) theo tài liệu BE
        HanBaoHanh: newBaoHanh.HanBaoHanhNCC,
        DanhSachSerial: danhSachSerial
      };

      await axios.post("http://localhost:3000/baohanh/taomoi", payload, { headers });
      alert("Tiếp nhận bảo hành thành công!");
      handleCloseCreateModal();
      loadDataBaoHanh();
    } catch (err) {
      alert("Lỗi tạo phiếu: " + (err.response?.data?.message || "Thất bại"));
    }
  };

  // 🌟 FIX UX 2: Hàm đóng Modal tiếp nhận và reset sạch sẽ dữ liệu
  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setCheckResult(null);
    setSearchQuery("");
    setSerialInput("");
    setNewBaoHanh({
      MaSanPham: "",
      MaKho: "1",
      MaNCC: "1",
      MaViTri: "",
      MaPhieu: "",
      TinhTrangLoi: "",
      LoaiBaoHanh: "Sửa chữa",
      TrangThai: "ChoBaoHanh",
      SoLuong: 1
    });
  };

  // 🌟 Hàm tải chi tiết sản phẩm của một phiếu khi nhấn nút Xem (Có logic dự phòng)
  const handleOpenSlipDetail = async (slip) => {
    setSelectedSlipGroup(slip);
    setIsItemsModalOpen(true);
    setItemsInSlip([]);
    const slipId = slip.MaPhieuBH || slip.id || slip.MaPhieu;
    
    // 🕵️ LOGIC BÓC TÁCH MÃ GỐC DÙNG CHUNG
    const findCode = (obj) => {
      const candidates = [
        obj.MaGoc, obj.MaPhieuXuatHienThi, obj.MaPhieuNhapHienThi, obj.MaPhieuGoc, obj.maPhieuGoc,
        obj.MaPX, obj.MaPN, obj.maPX, obj.maPN, obj.MaPhieuXuat, obj.MaPhieuNhap, obj.maPhieuXuat, obj.maPhieuNhap,
        obj.MaPhieu, obj.maPhieu
      ];
      let found = candidates.find(c => typeof c === 'string' && c !== "Lẻ" && (c.toUpperCase().startsWith('PX') || c.toUpperCase().startsWith('PN')));
      if (!found) {
        const match = JSON.stringify(obj).match(/(PX|PN)[A-Z0-9]+/i);
        if (match) found = match[0].toUpperCase();
      }
      return found;
    };

    const maGocActual = findCode(slip);
    
    let rawList = [];

    try {
      // 🌟 2. Ưu tiên: Lấy dữ liệu từ bảng chi tiết bảo hành (Các máy đã kích hoạt)
      let resDetail;
      try {
        // Thử lấy theo hồ sơ phiếu tổng
        resDetail = await axios.get(`http://localhost:3000/phieubaohanh/chitiet/${slipId}`, { headers });
      } catch (e) {
        // Thử lấy theo mã bảo hành máy lẻ (Dành cho trường hợp ID như 4004)
        resDetail = await axios.get(`http://localhost:3000/baohanh/chitiet/${slipId}`, { headers });
      }

      if (resDetail.data && resDetail.data.success) {
        const data = resDetail.data.data || resDetail.data;
        rawList = data.ChiTiet || data.chiTiet || data.items || (Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn("⚠️ Không tìm thấy chi tiết bảo hành lẻ, sẽ dùng dữ liệu từ phiếu gốc.");
    }

    // 🌟 3. DỰ PHÒNG: Nếu hồ sơ BH trống, truy vấn trực tiếp từ Phiếu Xuất/Nhập gốc
    if ((!rawList || rawList.length === 0) && maGocActual) {
      try {
        // Tự nhận diện endpoint dựa trên tiền tố mã hoặc loại phiếu
        const isExport = slip.LoaiPhieuBH === "KHACH_HANG" || maGocActual.startsWith("PX");
        const endpoint = isExport ? "phieuxuat" : "phieunhap";
        
        const origRes = await axios.get(`http://localhost:3000/${endpoint}/chitiet/${maGocActual}`, { headers });
        
        if (origRes.data.success) {
          const oData = origRes.data.data || origRes.data;
          // Bóc tách mảng hàng hóa linh hoạt theo cấu trúc từng loại phiếu
          rawList = isExport ? (oData.ChiTiet || oData.chiTiet || []) : (Array.isArray(oData) ? oData : (oData.ChiTiet || oData.chiTiet || []));
        }
      } catch (e) { console.error("Không thể lấy dữ liệu từ chứng từ gốc:", e); }
    }

    // 🌟 4. ENRICHMENT: Làm giàu thông tin sản phẩm và đồng bộ Key hiển thị
    const enrichedList = (rawList || []).map((it, idx) => {
      // 🌟 LẤY MÃ PHIẾU GỐC (PX/PN) TỪ DỮ LIỆU DÒNG HÀNG (Đồng bộ với Export/Import Page)
      const candidates = [it.MaPhieu, it.MaPhieuXuatHienThi, it.MaPhieuNhapHienThi, it.MaGoc, it.MaPhieuGoc];
      const rescuedMaGoc = candidates.find(c => typeof c === 'string' && c !== "Lẻ" && c !== "null" && (c.toUpperCase().startsWith('PX') || c.toUpperCase().startsWith('PN')));
      const finalRescued = rescuedMaGoc || (slip.LoaiPhieuBH === "NHA_CUNG_CAP" ? `Gửi NCC (#${slip.MaPhieuBH})` : `Phiếu BH (#${slip.MaPhieuBH})`);

      const productId = it.MaSanPham || it.MaSP || it.masanpham || it.productId || it.id;
      const productInfo = allProducts.find(p => String(p.id || p.MaSanPham || p.MaSP) === String(productId));
      
      return {
        ...it,
        MaBaoHanh: it.MaBaoHanh || it.id || `TMP-${idx}`,
        TenSanPham: it.TenSanPham || it.tensanpham || productInfo?.TenSanPham || productInfo?.name || `SP #${productId}`,
        MaSP: productInfo?.MaSP || productInfo?.code || it.MaSP || it.MaSPCode || it.MaSanPham || "—",
        SoSerial: it.SoSerial || it.serial || it.SoSerialHienThi || it.serialNumber || "—",
        MaGoc: finalRescued,
        MaPhieu: rescuedMaGoc || (slip.LoaiPhieuBH === "NHA_CUNG_CAP" ? `Gửi NCC (#${slip.MaPhieuBH})` : `Phiếu BH (#${slip.MaPhieuBH})`),
        SoLuong: Number(it.SoLuong || it.quantity || 1) // 🌟 Đồng bộ trường Số lượng từ dữ liệu gốc
      };
    });
    
    setItemsInSlip(enrichedList);
  };

  // ==========================================
  // 🌟 LOGIC LỌC DANH SÁCH PHIẾU THEO TAB & BÓC TÁCH MÃ GỐC THEO HƯỚNG DẪN BE
  // ==========================================

  const groupedSlips = useMemo(() => {
    // 1. Chuẩn hóa dữ liệu hiển thị (Bóc tách mã phiếu) trước khi lọc để phục vụ tìm kiếm
    const mappedSlips = danhSachPhieu.map(slip => {
      // 🌟 TÌM MÃ PX/PN THÔNG MINH (Bao quát mọi trường hợp BE trả về)
      const candidates = [
        slip.MaPhieuXuatHienThi, slip.MaPhieuNhapHienThi, 
        slip.MaPhieuGoc, slip.maPhieuGoc,
        slip.MaPX, slip.MaPN, slip.maPX, slip.maPN,
        slip.MaPhieuXuat, slip.MaPhieuNhap, slip.maPhieuXuat, slip.maPhieuNhap,
        slip.MaPhieu, slip.maPhieu
      ];

      const maGocActual = candidates.find(c => 
        typeof c === 'string' && 
        c !== "Lẻ" && 
        c !== "null" && 
        (c.toUpperCase().startsWith('PX') || c.toUpperCase().startsWith('PN'))
      );

      const finalMaGoc = maGocActual || (slip.LoaiPhieuBH === "NHA_CUNG_CAP" ? `Gửi NCC (#${slip.MaPhieuBH || slip.id})` : `Phiếu BH (#${slip.MaPhieuBH || slip.id})`);

      return {
      ...slip,
      MaPhieuHienThi: slip.MaPhieuBH || slip.id,
      MaGoc: finalMaGoc,
      DoiTac: slip.TenDoiTac || (slip.MaDoiTac ? `Đối tác #${slip.MaDoiTac}` : "Chưa xác định"),
      NgayLap: slip.NgayTaoPhieu || slip.CreatedAt,
      // Sử dụng SoLuong để đồng bộ với phiếu Nhập/Xuất
      SoLuong: slip.SoLuong || slip.TongSoLuong || (Array.isArray(slip.DanhSachMaBaoHanh) ? slip.DanhSachMaBaoHanh.length : (slip.Count || 0))
      }; // Đóng object literal
    }); // Đóng hàm map

    // 2. Lọc theo loại hình Tab (Xuất - Khách hàng / Nhập - NCC)
    let result = mappedSlips.filter(slip => {
      if (activeTab === "EXPORT") return slip.LoaiPhieuBH === "KHACH_HANG";
      return slip.LoaiPhieuBH === "NHA_CUNG_CAP";
    });

    // 3. Lọc theo từ khóa tìm kiếm
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      result = result.filter(slip => 
        String(slip.MaPhieuHienThi || "").toLowerCase().includes(s) || 
        String(slip.MaGoc || "").toLowerCase().includes(s) ||
        String(slip.MaPhieuXuatHienThi || "").toLowerCase().includes(s) ||
        String(slip.MaPhieuNhapHienThi || "").toLowerCase().includes(s) ||
        String(slip.TenDoiTac || "").toLowerCase().includes(s)
      );
    }

    return result;
  }, [danhSachPhieu, activeTab, searchTerm, activeKpiFilter]);

  // Cấu hình cột cho bảng Hồ sơ (Slips)
  const slipColumns = [
    { 
      key: "MaPhieuHienThi", 
      label: "Mã Hồ Sơ BH", 
      render: (v) => <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">#{v}</span> 
    },
    { 
      key: "MaGoc", 
      label: "Mã phiếu", 
      render: (v) => (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            String(v || '').toUpperCase().startsWith('PX') || String(v || '').includes('BH')
              ? 'bg-orange-500' 
              : 'bg-blue-500'
          }`}></div>
          <span className="font-mono font-bold text-gray-500 text-xs">{v || 'N/A'}</span>
        </div>
      )
    },
    { key: "DoiTac", label: "Đối tác liên quan", render: (v) => <span className="font-semibold text-gray-700">{v}</span> },
    { 
      key: "SoLuong", 
      label: "Số lượng", 
      render: (v) => (
        <div className="flex flex-col">
          <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg w-fit text-[11px]">{v} máy</span>
          <span className="text-[10px] text-gray-400">Tổng máy lỗi</span>
        </div>
      ) 
    },
    { key: "NgayLap", label: "Ngày lập hồ sơ", render: (v) => <span className="text-gray-500">{formatDate(v)}</span> },
    { 
      key: "actions", 
      label: "Thao tác", 
      render: (_, row) => (
        <button 
          onClick={() => handleOpenSlipDetail(row)}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-sm active:scale-95"
        >
          <Search size={14}/> Xem chi tiết & Xử lý
        </button>
      )
    }
  ];

  const customerColumns = [
    { 
      key: "select", 
      label: (
        <input 
          type="checkbox" 
          className="w-4 h-4 rounded border-gray-300"
          checked={itemsInSlip.length > 0 && itemsInSlip.every(i => selectedIds.includes(String(i.MaBaoHanh || i.id)))}
          onChange={() => {
            const allIds = itemsInSlip.map(i => String(i.MaBaoHanh || i.id));
            const areAllSelected = allIds.every(id => selectedIds.includes(id));
            setSelectedIds(prev => areAllSelected ? prev.filter(id => !allIds.includes(id)) : [...new Set([...prev, ...allIds])]);
          }}
        />
      ), 
      render: (_, row) => (
        <input 
          type="checkbox" 
          checked={selectedIds.includes(String(row.MaBaoHanh || row.id))}
          onChange={() => setSelectedIds(prev => prev.includes(String(row.MaBaoHanh || row.id)) ? prev.filter(id => id !== String(row.MaBaoHanh || row.id)) : [...prev, String(row.MaBaoHanh || row.id)])}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      )
    },
    { key: "MaBaoHanh", label: "Mã BH", render: (v) => <span className="font-mono font-bold text-gray-400">#{v}</span> },
    { key: "ProductInfo", label: "Thông tin Sản phẩm", render: (_, row) => (
      <div className="min-w-[200px]">
        <p className="font-bold text-gray-800 text-xs truncate" title={row.TenSanPham}>{row.TenSanPham || "N/A"}</p>
        <p className="text-[10px] text-gray-400">Mã SP: {row.MaSP || row.MaSanPham}</p>
        <p className="text-[10px] font-mono text-blue-600 font-bold">Serial: {row.SoSerial || "N/A"}</p>
      </div>
    )},
    { 
      key: "MaGoc", 
      label: "Mã phiếu", 
      render: (v, row) => (
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${
            String(v || '').toUpperCase().startsWith('PX') 
              ? 'bg-orange-500' 
              : String(v || '').toUpperCase().startsWith('PN') || String(v || '').includes('NCC')
                ? 'bg-blue-500' 
                : 'bg-orange-500'
          }`}></div>
          <span className="font-bold text-gray-600 text-[10px]">{v || "—"}</span>
        </div>
      )
    },
    { key: "SoLuong", label: "Số lượng", render: (v) => <span className="font-bold text-gray-700">{v} máy</span> }, // 🌟 Bổ sung cột SL
    { 
      key: "HanBaoHanh", 
      label: "Hạn BH Khách", 
      render: (v, row) => {
        const dateVal = row.HanBaoHanh || row.hanBaoHanh || row.HanBH || row.HanBaoHanh_KhachHang || v;
        const isExpired = dateVal && new Date(dateVal) < new Date(); 
        return <span className={`text-xs font-bold ${isExpired ? "text-red-500 bg-red-50 px-2 py-0.5 rounded" : "text-gray-700"}`}>{formatDate(dateVal)}</span>;
      }
    },
    { key: "TinhTrangLoi", label: "Lỗi Thực Tế", render: (v) => <p className="text-xs max-w-[150px] truncate italic text-gray-500" title={v}>{v || "Chưa nhập"}</p> },
    { key: "LoaiBaoHanh", label: "Loại BH", render: (v) => <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">{v}</span> },
    { key: "TrangThai", label: "Trạng thái xử lý", render: (v) => renderStatusTag(v) },
    { 
      key: "actions", 
      label: "Hành động", 
      render: (_, row) => (
        <button onClick={() => handleOpenEditModal(row)} className="text-blue-600 hover:text-blue-800 transition-colors">
          <Edit3 size={16}/>
        </button>
      )
    }
  ];

  const vendorColumns = [
    { 
      key: "select", 
      label: (
        <input 
          type="checkbox" 
          className="w-4 h-4 rounded border-gray-300"
          checked={itemsInSlip.length > 0 && itemsInSlip.every(i => selectedIds.includes(String(i.MaBaoHanh || i.id)))}
          onChange={() => {
            const allIds = itemsInSlip.map(i => String(i.MaBaoHanh || i.id));
            const areAllSelected = allIds.every(id => selectedIds.includes(id));
            setSelectedIds(prev => areAllSelected ? prev.filter(id => !allIds.includes(id)) : [...new Set([...prev, ...allIds])]);
          }}
        />
      ),
      render: (_, row) => (
        <input 
          type="checkbox" 
          checked={selectedIds.includes(String(row.MaBaoHanh || row.id))}
          onChange={() => setSelectedIds(prev => prev.includes(String(row.MaBaoHanh || row.id)) ? prev.filter(id => id !== String(row.MaBaoHanh || row.id)) : [...prev, String(row.MaBaoHanh || row.id)])}
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
      )
    },
    { key: "MaBaoHanh", label: "Mã Ký Gửi", render: (v) => <span className="font-mono font-bold text-gray-400">#{v}</span> },
    { key: "ProductInfo", label: "Sản phẩm & Serial", render: (_, row) => (
      <div className="min-w-[150px]">
        <p className="font-bold text-gray-800 text-xs">{row.TenSanPham}</p>
        <p className="text-[10px] font-mono text-indigo-600">SN: {row.SoSerial}</p>
      </div>
    )},
    { 
      key: "MaGoc", 
      label: "Mã phiếu", 
      render: (v, row) => (
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${
            String(v || '').toUpperCase().startsWith('PX') 
              ? 'bg-orange-500' 
              : String(v || '').toUpperCase().startsWith('PN') 
                ? 'bg-blue-500' 
                : 'bg-gray-300'
          }`}></div>
          <span className="font-bold text-gray-600 text-[10px]">{v || row.MaPhieu || row.MaPhieuXuat || row.MaPhieuNhap || "—"}</span>
        </div>
      )
    },
    { key: "SoLuong", label: "Số lượng", render: (v) => <span className="font-bold text-gray-700">{v} máy</span> }, // 🌟 Bổ sung cột SL
    { key: "SoLo", label: "Số Lô (Lot)", render: (v) => <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">{v || "N/A"}</span> },
    { 
      key: "HanBaoHanh", 
      label: "Hạn BH NCC", 
      render: (v, row) => {
        const dateVal = row.HanBaoHanh || row.hanBaoHanh || row.HanBH || row.HanBaoHanh_NCC || v;
        const isExpired = dateVal && new Date(dateVal) < new Date();
        return <span className={`text-xs font-bold ${isExpired ? "text-red-600 animate-pulse" : "text-blue-600"}`}>{formatDate(dateVal)}</span>;
      }
    },
    { key: "TrangThai", label: "Trạng thái NCC", render: (v) => renderStatusTag(v) },
    { 
      key: "Timeline", 
      label: "Tiến độ Hãng", 
      render: (_, row) => (
        <div className="text-[10px] space-y-0.5">
          <p><span className="text-gray-400">Gửi:</span> {formatDate(row.NgayGuiNCC)}</p>
          <p><span className="text-gray-400">Hẹn trả:</span> <span className="font-bold text-indigo-600">{row.NgayHenTraNCC ? new Date(row.NgayHenTraNCC).toLocaleDateString("vi-VN") : "---"}</span></p>
        </div>
      ) 
    },
    { 
      key: "actions", 
      label: "Cập nhật", 
      render: (_, row) => (
        <button onClick={() => handleOpenEditModal(row)} className="text-indigo-600 hover:text-indigo-800 font-bold text-[10px] bg-indigo-50 px-2 py-1 rounded">
          Hãng trả hàng
        </button>
      )
    }
  ];

  const renderStatusTag = (status) => {
    const config = {
      ChoBaoHanh: "bg-orange-50 text-orange-600 border-orange-200",
      DangBaoHanh: "bg-blue-50 text-blue-600 border-blue-200", 
      DaBaoHanh: "bg-green-50 text-green-600 border-green-200",   
      TuChoiBaoHanh: "bg-red-50 text-red-600 border-red-200", 
    };
    const labels = { ChoBaoHanh: "Chờ bảo hành", DangBaoHanh: "Đang bảo hành", DaBaoHanh: "Đã bảo hành", TuChoiBaoHanh: "Từ chối BH" };
    return (
      <span className={`px-2.5 py-1 text-xs font-bold border rounded-full ${config[status] || "bg-gray-50 text-gray-600"}`}>
        {labels[status] || status}
      </span>
    );
  };

  const handleCreateExportVendor = () => {
    if (selectedIds.length === 0) return alert("Vui lòng chọn ít nhất 1 sản phẩm lỗi để tạo phiếu gửi Hãng!");
    alert(`Hệ thống đang xuất danh sách bảo hành cho ${selectedIds.length} máy lỗi. Phiếu ký gửi NCC sẽ được tạo.`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Quản lý Bảo hành & Sửa chữa</h2>
            <p className="text-xs text-gray-500 mt-1">Theo dõi, điều phối luồng trạng thái tiếp nhận và xử lý hàng bảo hành</p>
          </div>
          <div className="flex gap-2">
            {activeTab === "VENDOR" && (
              <button 
                onClick={handleCreateExportVendor}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all"
              >
                <Truck size={16}/> Tạo phiếu gửi NCC ({selectedIds.length})
              </button>
            )}
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <PlusCircle size={16}/> Tiếp nhận từ Khách
            </button>
          </div>
        </div>

        {/* KPI STATS CARDS */}
        {/* Cập nhật logic lọc số lượng máy lỗi theo Tab Xuất/Nhập hiện tại */}
        {(() => {
          const filteredByTab = danhSachPhieu.filter(p => activeTab === "EXPORT" ? p.LoaiPhieuBH === "KHACH_HANG" : p.LoaiPhieuBH === "NHA_CUNG_CAP");
          const sumQty = (list) => list.reduce((sum, p) => sum + (p.SoLuong || p.TongSoLuong || 0), 0);

          return (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Users size={20}/></div>
            {/* Đổi từ đếm số phiếu sang cộng tổng số lượng máy để tránh sai lệch số liệu */}
            <div><p className="text-[10px] font-bold text-gray-400 uppercase">Mới (Số máy)</p><h3 className="text-xl font-bold text-gray-800">{sumQty(filteredByTab.filter(p => p.TrangThai === "ChoBaoHanh"))}</h3></div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Clock size={20}/></div>
            <div><p className="text-[10px] font-bold text-gray-400 uppercase">Đang xử lý</p><h3 className="text-xl font-bold text-amber-600">{sumQty(filteredByTab.filter(p => p.TrangThai === "DangBaoHanh"))}</h3></div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600"><Archive size={20}/></div>
            <div><p className="text-[10px] font-bold text-gray-400 uppercase">Đang gom hàng</p><h3 className="text-xl font-bold text-purple-600">{sumQty(filteredByTab.filter(p => p.TrangThai === "GomHang"))}</h3></div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600"><AlertTriangle size={20}/></div>
            <div><p className="text-[10px] font-bold text-gray-400 uppercase">Hết hạn NCC</p><h3 className="text-xl font-bold text-red-600">{sumQty(filteredByTab.filter(p => p.HanBaoHanh_NCC && new Date(p.HanBaoHanh_NCC) < new Date()))}</h3></div>
          </div>
        </div>
          );
        })()}

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-gray-200 bg-white p-2 rounded-xl shadow-xs gap-2">
          <button
            onClick={() => { setActiveTab("EXPORT"); setSelectedIds([]); }}
            className={`flex-1 sm:flex-none px-6 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === "EXPORT" ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <FileOutput size={14}/> 1. GOM THEO PHIẾU XUẤT
          </button>
          <button
            onClick={() => { setActiveTab("IMPORT"); setSelectedIds([]); }}
            className={`flex-1 sm:flex-none px-6 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === "IMPORT" ? "bg-indigo-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <FileInput size={14}/> 2. GOM THEO PHIẾU NHẬP
          </button>
        </div>

        {/* 🌟 SEARCH BAR & REFRESH: Quản lý phiếu thông minh */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
            <input 
              type="text"
              placeholder="Nhập mã Phiếu Xuất/Nhập để tìm kiếm..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={loadDataBaoHanh} className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Làm mới danh sách
          </button>
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}

        {/* DANH SÁCH PHIẾU BẢO HÀNH */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-gray-400 gap-2 text-sm"><Loader2 className="animate-spin" size={18}/> Đang tải dữ liệu...</div>
          ) : (
            <DataTable
              data={groupedSlips}
              columns={slipColumns}
            />
          )}
        </div>

        {/* ==========================================
            MODAL CẬP NHẬT TRẠNG THÁI PHIẾU BẢO HÀNH
           ========================================== */}
        {isModalOpen && selectedPhieu && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-2xl border border-gray-100 mx-4">
              <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">⚙️ Xử lý bảo hành: <span className="font-mono text-blue-600">{selectedPhieu.MaBaoHanh}</span></h3>
              <div className="text-xs text-gray-500 mb-4 border-b pb-3 space-y-1">
                <p><span className="font-semibold text-gray-700">Sản phẩm:</span> {selectedPhieu.TenSanPham || `Mã #${selectedPhieu.MaSanPham}`}</p>
                <div className="grid grid-cols-2 gap-y-1">
                  <p><span className="font-semibold">Số Serial:</span> {selectedPhieu.SoSerial || "---"}</p>
                  <p><span className="font-semibold">Phiếu xuất:</span> {selectedPhieu.MaPhieu || "---"}</p>
                  <p><span className="font-semibold">Số Lô:</span> {selectedPhieu.SoLo || "---"}</p>
                  <p><span className="font-semibold">Số lượng:</span> {selectedPhieu.SoLuong || 1}</p>
                  <p><span className="font-semibold">Hạn bảo hành:</span> {selectedPhieu.HanBaoHanh ? new Date(selectedPhieu.HanBaoHanh).toLocaleDateString("vi-VN") : "N/A"}</p>
                </div>
              </div>

              <form onSubmit={handleSubmitTrangThai} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Chuyển trạng thái sang</label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* 🌟 FIX UX 1: Cho phép Từ chối ngay khi phiếu đang ở trạng thái Chờ */}
                    {selectedPhieu.TrangThai === "ChoBaoHanh" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setFormState(prev => ({ ...prev, TrangThaiMoi: "DangBaoHanh" }))}
                          className={`p-3 text-xs font-bold border rounded-xl flex items-center justify-between transition-all ${formState.TrangThaiMoi === "DangBaoHanh" ? "border-blue-500 bg-blue-50/50 text-blue-600 shadow-xs" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                        >
                          Đưa vào xử lý <ArrowRight size={14}/>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormState(prev => ({ ...prev, TrangThaiMoi: "TuChoiBaoHanh" }))}
                          className={`p-3 text-xs font-bold border rounded-xl flex items-center justify-between transition-all ${formState.TrangThaiMoi === "TuChoiBaoHanh" ? "border-red-500 bg-red-50/50 text-red-600 shadow-xs" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                        >
                          Từ chối bảo hành <XCircle size={14}/>
                        </button>
                      </>
                    )}
                    
                    {selectedPhieu.TrangThai === "DangBaoHanh" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setFormState(prev => ({ ...prev, TrangThaiMoi: "DaBaoHanh" }))}
                          className={`p-3 text-xs font-bold border rounded-xl flex items-center justify-between transition-all ${formState.TrangThaiMoi === "DaBaoHanh" ? "border-green-500 bg-green-50/50 text-green-600 shadow-xs" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                        >
                          Hoàn thành sửa <CheckCircle size={14}/>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormState(prev => ({ ...prev, TrangThaiMoi: "TuChoiBaoHanh" }))}
                          className={`p-3 text-xs font-bold border rounded-xl flex items-center justify-between transition-all ${formState.TrangThaiMoi === "TuChoiBaoHanh" ? "border-red-500 bg-red-50/50 text-red-600 shadow-xs" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                        >
                          Từ chối bảo hành <XCircle size={14}/>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mã Phiếu Xuất (Code)</label>
                    <input
                      type="text" // Chuyển từ number sang text
                      placeholder="VD: PX00123"
                      value={formState.MaPhieu}
                      onChange={(e) => setFormState(prev => ({ ...prev, MaPhieu: e.target.value }))}
                      className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-blue-500 bg-gray-50/50 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Số lượng</label>
                    <input
                      type="number" min="1"
                      value={formState.SoLuong}
                      onChange={(e) => setFormState(prev => ({ ...prev, SoLuong: e.target.value }))}
                      className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-blue-500 bg-gray-50/50 focus:bg-white transition-all font-bold text-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hướng xử lý</label>
                    <input
                      type="text"
                      placeholder="VD: Thay màn hình..."
                      value={formState.HuongXuLy}
                      onChange={(e) => setFormState(prev => ({ ...prev, HuongXuLy: e.target.value }))}
                      className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-blue-500 bg-gray-50/50 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Ghi chú thêm</label>
                    <input
                      type="text"
                      placeholder="VD: Khách lấy gấp..."
                      value={formState.GhiChu}
                      onChange={(e) => setFormState(prev => ({ ...prev, GhiChu: e.target.value }))}
                      className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-blue-500 bg-gray-50/50 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 flex items-center gap-1.5"><Warehouse size={13}/> Chọn Kho lưu trữ</label>
                    <select
                      value={formState.MaKho}
                      onChange={(e) => setFormState(prev => ({ ...prev, MaKho: e.target.value, MaViTri: "" }))}
                      className="w-full text-xs rounded-lg border border-gray-200 bg-white px-2 py-2 outline-none focus:border-blue-500"
                    >
                      <option value="">-- Chọn kho hàng --</option>
                      {danhSachKho.map(k => (
                        <option key={k.MaKho} value={k.MaKho}>{k.TenKho}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 flex items-center gap-1.5">
                      <MapPin size={13}/> Vị trí kệ cụ thể
                      {loadingViTriSua && <Loader2 className="animate-spin text-blue-500" size={10}/>}
                    </label>
                    <select
                      disabled={!formState.MaKho || loadingViTriSua}
                      value={formState.MaViTri}
                      onChange={(e) => setFormState(prev => ({ ...prev, MaViTri: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-gray-200 bg-white px-2 py-2 outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">-- {formState.MaKho ? "Chọn vị trí" : "Vui lòng chọn kho trước"} --</option>
                      {danhSachViTriSua.map(v => (
                        <option key={v.MaViTri} value={v.MaViTri}>{v.TenViTriHienThi || v.MaViTriCode || v.MaViTri}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200"
                  >
                    Hủy thao tác
                  </button>
                  <button
                    type="submit"
                    // 🌟 FIX LỖI 2: Cho phép bấm nếu có thay đổi bất kỳ trường nào trong form so với ban đầu
                    disabled={
                      formState.TrangThaiMoi === selectedPhieu.TrangThai &&
                      formState.HuongXuLy === (selectedPhieu.HuongXuLy || "") &&
                      formState.GhiChu === (selectedPhieu.GhiChu || "") &&
                      formState.MaKho === (selectedPhieu.MaKho ? String(selectedPhieu.MaKho) : "") &&
                      formState.MaViTri === (selectedPhieu.MaViTri ? String(selectedPhieu.MaViTri) : "") &&
                      formState.MaPhieu === (selectedPhieu.MaPhieu || "")
                    }
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Xác nhận cập nhật
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==========================================
            MODAL TIẾP NHẬN MỚI (LUỒNG 2 BƯỚC)
           ========================================== */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">🆕 Tiếp nhận máy lỗi bảo hành</h3>
                <button onClick={handleCloseCreateModal} className="text-gray-400 hover:text-gray-600 text-2xl font-light">&times;</button>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                <label className="block text-xs font-bold text-blue-700 mb-2 uppercase">Bước 1: Kiểm tra bảo hành gốc</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Nhập Mã Phiếu Xuất hoặc Số Serial để check..."
                    className="flex-1 px-4 py-2 rounded-lg border border-blue-200 text-sm outline-none focus:border-blue-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCheckWarranty()}
                  />
                  <button 
                    onClick={handleCheckWarranty}
                    disabled={isChecking}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                  >
                    {isChecking ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>} Kiểm tra
                  </button>
                </div>

                {checkResult && (
                  <div className="mt-4 space-y-4 animate-fade-in">
                    <div className="p-3 bg-white rounded-xl border border-blue-100 shadow-sm flex items-center justify-between">
                      <div>
                         <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sản phẩm phát hiện</p>
                         <h4 className="text-sm font-bold text-gray-800">{checkResult.TenSanPham}</h4>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Định danh</p>
                         <p className="text-xs font-mono font-bold text-blue-600">{checkResult.SoSerial || checkResult.SoLo}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/*  Khối 1: THÔNG TIN BẢO HÀNH KHÁCH HÀNG */}
                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
                        <h5 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-2"><User size={14} className="text-blue-500"/> BẢO HÀNH KHÁCH HÀNG</h5>
                        <div className="space-y-2 text-xs">
                          <p className="flex justify-between"><span className="text-gray-500">Khách hàng:</span> <span className="font-bold text-gray-800">{checkResult.BaoHanhKhachHang.KhachHang}</span></p>
                          <p className="flex justify-between"><span className="text-gray-500">Số điện thoại:</span> <span className="font-medium">{checkResult.BaoHanhKhachHang.DienThoai}</span></p>
                          <p className="flex justify-between"><span className="text-gray-500">Ngày mua:</span> <span className="font-medium">{new Date(checkResult.BaoHanhKhachHang.NgayMuaKho).toLocaleDateString("vi-VN")}</span></p>
                          <div className="pt-2 border-t mt-2">
                            <span className={`px-2 py-1 rounded-md font-bold text-[10px] uppercase border ${checkResult.BaoHanhKhachHang.TrangThai.includes("Còn bảo hành") ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                              {checkResult.BaoHanhKhachHang.TrangThai}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Khối 2: ĐỐI SOÁT VỚI NHÀ CUNG CẤP */}
                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
                        <h5 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-2"><ShieldAlert size={14} className="text-orange-500"/> ĐỐI SOÁT NHÀ CUNG CẤP</h5>
                        <div className="space-y-2 text-xs">
                          <p className="flex justify-between"><span className="text-gray-500">Ngày nhập kho:</span> <span className="font-medium">{new Date(checkResult.DoiSoatNhaCungCap.NgayNhapKho).toLocaleDateString("vi-VN")}</span></p>
                          <p className="flex justify-between"><span className="text-gray-500">Hạn BH của NCC:</span> <span className="font-bold text-gray-800">{new Date(checkResult.DoiSoatNhaCungCap.HanBaoHanhNCC).toLocaleDateString("vi-VN")}</span></p>
                          <div className="pt-2 border-t mt-2">
                            <span className={`px-2 py-1 rounded-md font-bold text-[10px] uppercase border ${checkResult.DoiSoatNhaCungCap.TrangThaiDoiSoat.includes("⚠️ NCC ĐÃ HẾT HẠN!") ? "bg-red-600 text-white border-red-700 animate-pulse" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                              {checkResult.DoiSoatNhaCungCap.TrangThaiDoiSoat}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {checkResult && (
                <form onSubmit={handleCreateBaoHanh} className="space-y-4">
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest border-l-2 border-blue-500 pl-2">Bước 2: Lập hồ sơ tiếp nhận</label>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase">Kho lưu trữ</label>
                      <select 
                        className="w-full text-sm border rounded-xl p-2.5 bg-gray-50 focus:bg-white outline-none focus:border-blue-500" 
                        value={newBaoHanh.MaKho} 
                        onChange={(e) => setNewBaoHanh({...newBaoHanh, MaKho: e.target.value, MaViTri: ""})}
                      >
                         {danhSachKho.map(k => <option key={k.MaKho} value={k.MaKho}>{k.TenKho}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase">Vị trí kệ nhận</label>
                      <select 
                        className="w-full text-sm border rounded-xl p-2.5 bg-gray-50 disabled:opacity-50 focus:bg-white outline-none focus:border-blue-500"
                        value={newBaoHanh.MaViTri}
                        disabled={loadingViTriTao}
                        onChange={(e) => setNewBaoHanh({...newBaoHanh, MaViTri: e.target.value})}
                      >
                        <option value="">-- Chọn vị trí kệ --</option>
                        {danhSachViTriTao.map(v => (
                          <option key={v.MaViTri} value={v.MaViTri}>{v.TenViTriHienThi || v.MaViTriCode || v.MaViTri}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase">Loại hình bảo hành</label>
                      <select className="w-full text-sm border rounded-xl p-2.5 bg-gray-50 focus:bg-white outline-none focus:border-blue-500 font-bold" value={newBaoHanh.LoaiBaoHanh} onChange={(e) => setNewBaoHanh({...newBaoHanh, LoaiBaoHanh: e.target.value})}>
                         <option value="Sửa chữa">Sửa chữa</option>
                         <option value="Đổi mới">Đổi mới</option>
                         <option value="Bảo hành hãng">Bảo hành hãng</option>
                      </select>
                    </div>
                  </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase">Số lượng lỗi (Nếu không có Serial)</label>
                          <input 
                            type="number" min="1"
                            className="w-full text-sm border rounded-xl p-2.5 bg-gray-50 focus:bg-white outline-none focus:border-blue-500 font-bold text-blue-600"
                            value={newBaoHanh.SoLuong}
                            onChange={(e) => setNewBaoHanh({...newBaoHanh, SoLuong: e.target.value})}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase">Serial máy lỗi (Mỗi dòng 1 mã)</label>
                          <textarea 
                            rows="2"
                            placeholder="VD:&#10;SN-DELL-001&#10;SN-DELL-002"
                            className="w-full text-sm border rounded-xl p-2.5 font-mono bg-gray-50 focus:bg-white outline-none focus:border-blue-500"
                            value={serialInput}
                            onChange={(e) => setSerialInput(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase">Mô tả tình trạng lỗi</label>
                    <input 
                      type="text" 
                      placeholder="VD: Không lên nguồn..."
                      className="w-full text-sm border rounded-lg p-2 bg-gray-50 focus:bg-white outline-none"
                      value={newBaoHanh.TinhTrangLoi}
                      onChange={(e) => setNewBaoHanh({...newBaoHanh, TinhTrangLoi: e.target.value})}
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button 
                      type="button" 
                      onClick={handleCloseCreateModal}
                      className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200"
                    >Hủy</button>
                    <button 
                      type="submit"
                      className="px-6 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md"
                    >Xác nhận tiếp nhận</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            MODAL 3: DANH SÁCH SẢN PHẨM TRONG HỒ SƠ
           ========================================== */}
        {isItemsModalOpen && selectedSlipGroup && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="px-6 py-5 bg-gray-50 border-b flex justify-between items-center shrink-0">
                {/* Bọc phần tiêu đề và mô tả trong một div rõ ràng hơn */}
                <div className="flex flex-col">
                  <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                    <Package className="text-blue-600"/> CHI TIẾT THIẾT BỊ TRONG PHIẾU: #{selectedSlipGroup.MaPhieuHienThi}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Mã phiếu: <span className="font-bold text-orange-600 uppercase">{selectedSlipGroup.MaGoc}</span> 
                    {" • Quy mô: "} 
                    <span className="text-blue-600 font-bold">
                      {itemsInSlip.reduce((sum, item) => sum + (Number(item.SoLuong) || 0), 0)} máy
                    </span> 
                  </p>
                </div>
                <button onClick={() => setIsItemsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all text-2xl">&times;</button>
              </div>

              <div className="p-6 overflow-y-auto grow">
                <div className="mb-4 flex justify-between items-center">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-3 py-2 rounded-xl border border-amber-100">
                      <AlertTriangle size={12}/> Bạn có thể tích chọn nhiều máy bên dưới để thực hiện xử lý đồng loạt.
                    </div>
                  </div>
                  {selectedIds.length > 0 && (
                    <button 
                      onClick={handleCreateExportVendor}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 shadow-sm animate-in slide-in-from-right-2"
                    >
                      <Truck size={12}/> Xử lý {selectedIds.length} máy đã chọn
                    </button>
                  )}
                </div>
                
                {/* 🌟 FIX: Sử dụng itemsInSlip được fetch từ API chi tiết */}
                <DataTable
                  loading={itemsInSlip.length === 0 && selectedSlipGroup?.SoLuongMay > 0} 
                  data={itemsInSlip}
                  // 🌟 TỐI ƯU: Chọn cột dựa trên loại phiếu thực tế thay vì Tab hiện tại
                  columns={selectedSlipGroup?.LoaiPhieuBH === "KHACH_HANG" ? customerColumns : vendorColumns}
                />
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3 shrink-0">
                <button onClick={() => setIsItemsModalOpen(false)} className="px-6 py-2 bg-white border rounded-xl text-xs font-bold shadow-sm hover:bg-gray-50 transition-all">Đóng danh sách</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}