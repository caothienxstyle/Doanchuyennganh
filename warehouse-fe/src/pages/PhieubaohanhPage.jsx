import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Plus, Trash2, ShieldAlert, FileText, Package, Save, Timer, FileInput, FileOutput, ArrowRight,
  CheckCircle, Loader2, Info, Users, Clock, Archive, Edit3, Search, Eye, FilePlus, ShieldCheck,
  AlertTriangle, Warehouse, MapPin, Hash, ClipboardList, RefreshCcw, Calendar, History, FilePlus2
} from "lucide-react";
import { getCurrentRole } from "../services/auth";
import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable";
import { useLocation } from "react-router-dom";

export default function PhieubaohanhPage() {
  const role = getCurrentRole();
  const getToken = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
  const headers = { Authorization: `Bearer ${getToken()}` };
  const location = useLocation();

  // --- QUẢN LÝ DANH SÁCH & HIỂN THỊ ---
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [searchTermHistory, setSearchTermHistory] = useState("");
  const [activeKpiFilter, setActiveKpiFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState(""); // State mới cho lọc từ ngày
  const [endDateFilter, setEndDateFilter] = useState("");     // State mới cho lọc đến ngày
  const [activeHistoryTab, setActiveHistoryTab] = useState("EXPORT"); // "EXPORT" | "IMPORT"
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // 🔢 Trạng thái Phân trang & Tiện ích
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState("1");

  // --- STATE XEM CHI TIẾT ---
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSlipDetail, setSelectedSlipDetail] = useState(null);
  const [itemsInSlip, setItemsInSlip] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // --- STATE QUẢN LÝ PHIẾU TỔNG ---
  const [loaiPhieuBH, setLoaiPhieuBH] = useState("KHACH_HANG");
  const [maDoiTac, setMaDoiTac] = useState("");
  const [soHopDong, setSoHopDong] = useState("");
  const [ghiChuTongQuat, setGhiChuTongQuat] = useState("");
  const [ngayTaoPhieu, setNgayTaoPhieu] = useState(new Date().toISOString().split("T")[0]);

  const [loaiChungTuGoc, setLoaiChungTuGoc] = useState("EXPORT"); // "EXPORT" | "IMPORT"
  const [maChungTuGoc, setMaChungTuGoc] = useState("");
  const [ticketSearchTerm, setTicketSearchTerm] = useState("");

  // Mới: Quản lý thời hạn bảo hành
  const [warrantyValue, setWarrantyValue] = useState(12); // Số lượng
  const [warrantyUnit, setWarrantyUnit] = useState("MONTH"); // "MONTH" | "YEAR"

  // --- MASTER DATA ---
  const [danhSachKH, setDanhSachKH] = useState([]);
  const [danhSachNCC, setDanhSachNCC] = useState([]);
  const [danhSachKho, setDanhSachKho] = useState([]);
  const [danhSachSP, setDanhSachSP] = useState([]);
  const [danhSachViTri, setDanhSachViTri] = useState([]);
  const [danhSachPX, setDanhSachPX] = useState([]);
  const [danhSachPN, setDanhSachPN] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [itemsFromTicket, setItemsFromTicket] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const fetchData = async () => {
    try {
      setLoadingPage(true);
      const [kh, ncc, kho, sp, vt, px, pn] = await Promise.all([
        axios.get("http://localhost:3000/khachhang/danhsach", { headers }),
        axios.get("http://localhost:3000/nhacungcap/danhsach", { headers }),
        axios.get("http://localhost:3000/kho/danhsach", { headers }),
        axios.get("http://localhost:3000/products/danhsachsanpham", { headers }),
        axios.get("http://localhost:3000/vitrikho/danhsach", { headers }),
        axios.get("http://localhost:3000/phieuxuat/danhsach", { headers }),
        axios.get("http://localhost:3000/phieunhap/danhsach", { headers })
      ]);
      setDanhSachKH(kh.data.data || kh.data || []);
      setDanhSachNCC(ncc.data.data || ncc.data || []);
      setDanhSachKho(kho.data.data || kho.data || []);
      setDanhSachSP(Array.isArray(sp.data) ? sp.data : sp.data.data || []);
      setDanhSachViTri(vt.data.data || vt.data || []);
      // 🌟 FIX: Đón đầu cả 2 cấu trúc trả về của API Phiếu Xuất
      setDanhSachPX(px.data.data || px.data || []);
      setDanhSachPN(pn.data.data || pn.data || []);
    } catch (err) {
      console.error("Lỗi tải dữ liệu ban đầu:", err);
    } finally {
      setLoadingPage(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      // 🌟 FIX: Thêm tham số soLuong lớn để lấy toàn bộ dữ liệu phục vụ phân trang tại Frontend
      const res = await axios.get("http://localhost:3000/phieubaohanh/danhsach?soLuong=5000", { headers });
      if (res.data.success) {
        setHistoryList(res.data.data || []);
      }
    } catch (err) {
      console.error("Lỗi tải lịch sử phiếu bảo hành:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchHistory();
  }, []);

  // 🔄 Tự động reset trang khi tìm kiếm hoặc lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTermHistory, activeKpiFilter, activeHistoryTab, startDateFilter, endDateFilter, itemsPerPage]);

  // Đồng bộ ô nhập trang nhanh
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Tự động kích hoạt form nếu được điều hướng từ trang Xuất/Nhập kho
  useEffect(() => {
    if (location.state?.maPhieu) {
      setMaChungTuGoc(location.state.maPhieu);
      setLoaiChungTuGoc(location.state.type || "EXPORT");
      setIsCreateModalOpen(true);
    }
  }, [location]);

  // Hàm tính toán ngày hết hạn
  const calculateExpiry = (baseDateString) => {
    if (!baseDateString) return ""; // If no base date, no expiry

    const d = new Date(baseDateString);
    if (isNaN(d.getTime())) return ""; // If baseDateString is invalid, return empty

    const value = parseInt(warrantyValue);
    if (isNaN(value) || value < 0) return ""; // If warrantyValue is invalid or negative, return empty

    if (warrantyUnit === "MONTH") {
      d.setMonth(d.getMonth() + value);
    } else {
      d.setFullYear(d.getFullYear() + value);
    }
    return d.toISOString().split("T")[0]; // Return formatted date string
  };

  // Hàm tính toán thời gian còn lại (Display text)
  const getRemainingTime = (expiryDate) => {
    if (!expiryDate || expiryDate === "N/A" || expiryDate === "—") return "—";
    const d = new Date(expiryDate);
    if (isNaN(d.getTime())) return "—";

    const diff = d - new Date();
    if (diff < 0) return "Đã hết hạn";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const remDays = days % 30;
    return `${months > 0 ? months + " tháng " : ""}${remDays} ngày`;
  };

  // Tự động tải chi tiết sản phẩm khi chọn Phiếu
  useEffect(() => {
    if (!maChungTuGoc) {
      setItemsFromTicket([]);
      return;
    }

    const ticketList = loaiChungTuGoc === "EXPORT" ? danhSachPX : danhSachPN;
    const ticketInfo = ticketList.find(t => String(t.MaPhieu) === String(maChungTuGoc));

    if (ticketInfo) {
      if (loaiChungTuGoc === "EXPORT") {
        setLoaiPhieuBH("KHACH_HANG");
        if (ticketInfo.MaKH) setMaDoiTac(String(ticketInfo.MaKH));
      } else {
        setLoaiPhieuBH("NHA_CUNG_CAP");
        if (ticketInfo.MaNCC) setMaDoiTac(String(ticketInfo.MaNCC));
      }
    }

    const loadTicketDetail = async () => {
      try {
        setLoadingItems(true);
        let rawItems = [];
        if (loaiChungTuGoc === "EXPORT") {
          const res = await axios.get(`http://localhost:3000/phieuxuat/chitiet/${maChungTuGoc}`, { headers });
          if (res.data.success) rawItems = res.data.data?.ChiTiet || [];
        } else {
          // 🌟 FIX LỖI "Invalid number": Truy xuất ID số từ danh sách PN đã load
          const pnRecord = danhSachPN.find(p => String(p.MaPhieu) === String(maChungTuGoc));
          const ticketId = pnRecord?.MaPhieuNhap || pnRecord?.id || ticketInfo?.MaPhieuNhap;

          if (!ticketId || isNaN(Number(ticketId))) {
            console.warn("⚠️ Không tìm thấy ID số cho phiếu nhập:", maChungTuGoc);
            setItemsFromTicket([]);
            return;
          }
          const res = await axios.get(`http://localhost:3000/phieunhap/chitiet/${ticketId}`, { headers });
          if (res.data.success) rawItems = res.data.data || [];
        }

        // 🌟 BỔ SUNG: Ánh xạ tên sản phẩm từ danh mục tổng để hiển thị dễ đọc trong bảng tiếp nhận
        const enrichedItems = rawItems.map(item => {
          // Linh hoạt bóc tách ID sản phẩm từ các định dạng key khác nhau của Backend
          const targetId = item.MaSanPham || item.MaSP || item.masanpham || item.id;
          const productInfo = danhSachSP.find(p => String(p.id || p.MaSanPham || p.MaSP) === String(targetId));
          return {
            ...item,
            MaSanPham: targetId, // Đảm bảo luôn có key MaSanPham để phục vụ việc lập hồ sơ lẻ
            TenSanPham: productInfo?.TenSanPham || productInfo?.name || item.TenSanPham || (item.MaSP ? `Sản phẩm mã ${item.MaSP}` : `Sản phẩm #${targetId}`),
            barcode: productInfo?.barcode || productInfo?.Barcode || item.barcode || item.Barcode || "—",
            QRCode: productInfo?.qrCode || productInfo?.QRCode || item.qrCode || item.QRCode || "—"
          };
        });
        setItemsFromTicket(enrichedItems);
      } catch (err) {
        console.error("Lỗi tải chi tiết chứng từ:", err);
      } finally {
        setLoadingItems(false);
      }
    };
    loadTicketDetail();
  }, [maChungTuGoc, loaiChungTuGoc, danhSachSP, danhSachPX, danhSachPN]);

  const currentExpiryPreview = useMemo(() => {
    const t = (loaiChungTuGoc === "EXPORT" ? danhSachPX : danhSachPN).find(ticket => String(ticket.MaPhieu) === String(maChungTuGoc));
    const baseDate = (loaiChungTuGoc === "EXPORT" ? t?.NgayXuat : t?.NgayNhap) || ngayTaoPhieu;
    return calculateExpiry(baseDate);
  }, [loaiChungTuGoc, danhSachPX, danhSachPN, maChungTuGoc, ngayTaoPhieu, warrantyValue, warrantyUnit]);

  // 🔍 Logic lọc danh sách phiếu xuất/nhập khi đang chọn để lập hồ sơ
  const filteredTicketsForSelect = useMemo(() => {
    const list = loaiChungTuGoc === "EXPORT" ? danhSachPX : danhSachPN;
    const search = ticketSearchTerm.toLowerCase().trim();
    if (!search) return list;

    return list.filter(t => {
      const maPhieu = String(t.MaPhieu || "").toLowerCase();
      let partnerName = "";
      if (loaiChungTuGoc === "EXPORT") {
        partnerName = (t.TenKH || danhSachKH.find(k => String(k.MaKH) === String(t.MaKH))?.TenKH || `KH #${t.MaKH}`).toLowerCase();
      } else {
        partnerName = (t.TenNCC || danhSachNCC.find(n => String(n.MaNCC) === String(t.MaNCC))?.TenNCC || `NCC #${t.MaNCC}`).toLowerCase();
      }

      return maPhieu.includes(search) || partnerName.includes(search);
    });
  }, [loaiChungTuGoc, danhSachPX, danhSachPN, ticketSearchTerm, danhSachKH, danhSachNCC]);

  // Hàm mở xem chi tiết phiếu đã tạo - SIÊU THÔNG MINH & ĐỐI SOÁT SONG HÀNH
  const handleOpenDetail = async (slip) => {
    // 1. Xác định mã định danh chính xác của Phiếu Bảo Hành
    const slipId = slip.MaPhieuBH || slip.id || slip.MaPhieu;

    setSelectedSlipDetail(slip);
    setIsDetailModalOpen(true);
    setLoadingDetail(true);
    setItemsInSlip([]); // Xóa trắng để tránh hiện dữ liệu cũ

    try {
       console.log("🔍 Đang mở chi tiết hồ sơ:", slip);
       let warrantyItems = [];

       // 1. Xác định Mã chứng từ gốc - QUÉT TỰ ĐỘNG GIÁ TRỊ (Khử "Lẻ")
       const findDocCode = (obj) => {
         const candidates = [
           obj.MaPhieuXuatHienThi, obj.MaPhieuNhapHienThi,
           obj.MaPhieuGoc, obj.maPhieuGoc,
           obj.MaPX, obj.maPX, obj.MaPN, obj.maPN,
           obj.MaPhieuXuat, obj.maPhieuXuat, obj.MaPhieuNhap, obj.maPhieuNhap,
           obj.MaPhieu, obj.maPhieu
         ];
         const found = candidates.find(c =>
           typeof c === 'string' &&
           c !== "Lẻ" &&
           (c.toUpperCase().startsWith('PX') || c.toUpperCase().startsWith('PN'))
         );
         return found || (obj.LoaiPhieuBH === "NHA_CUNG_CAP" ? `Gửi NCC (#${obj.MaPhieuBH || obj.id})` : `Phiếu BH (#${obj.MaPhieuBH || obj.id})`);
       };

       let maGocRaw = findDocCode(slip);
       const maGocActual = typeof maGocRaw === "string" ? maGocRaw.trim() : maGocRaw;
       console.log("📌 Mã chứng từ gốc xác định được:", maGocActual);

       try {
          // 2. Lấy dữ liệu chi tiết bảo hành (Các máy đã kích hoạt)
          let resDetail;
          try {
            resDetail = await axios.get(`http://localhost:3000/phieubaohanh/chitiet/${slipId}`, { headers });
          } catch (e) {
            // Fallback sang endpoint máy lẻ nếu ID không phải là hồ sơ tổng
            resDetail = await axios.get(`http://localhost:3000/baohanh/chitiet/${slipId}`, { headers });
          }

          if (resDetail.data.success) {
             const wData = resDetail.data.data || resDetail.data;
             // Dò tìm mảng hàng hóa linh hoạt
             warrantyItems = wData.ChiTiet || wData.chiTiet || wData.DanhSachBaoHanh || wData.items || (Array.isArray(wData) ? wData : []);

             // 🌟 CẢI TIẾN: Nếu maGocActual vẫn undefined, thử lấy từ item đầu tiên của danh sách bảo hành
             if (!maGocActual && warrantyItems.length > 0) {
                const firstItem = warrantyItems[0];
                const maGocFromItem = firstItem.MaPhieu || firstItem.maPhieu || firstItem.MaPhieuGoc;
                if (maGocFromItem) console.log("✅ Tìm thấy mã gốc từ sản phẩm lẻ:", maGocFromItem);
             }
          }
       } catch (err) {
          console.warn("⚠️ Không tìm thấy chi tiết bảo hành lẻ, sẽ dùng dữ liệu từ phiếu gốc.");
       }

       // 3. Tự nhận diện loại phiếu (Xuất/Nhập) để gọi đúng API đối soát
       const loaiBH = slip.LoaiPhieuBH || (maGocActual?.startsWith('PX') ? "KHACH_HANG" : "NHA_CUNG_CAP");
       let originalTicketItems = [];

       if (maGocActual) {
           if (loaiBH === "KHACH_HANG") {
               try {
                   const res = await axios.get(`http://localhost:3000/phieuxuat/chitiet/${maGocActual}`, { headers });
                   console.log("🚚 Kết quả API Phiếu Xuất gốc:", res.data);
                   if (res.data.success) {
                       const oData = res.data.data || res.data;
                       originalTicketItems = oData.ChiTiet || oData.chiTiet || (Array.isArray(oData) ? oData : []);
                   }
               } catch (e) { console.error("Lỗi gọi API Phiếu Xuất:", e); }
           } else if (loaiBH === "NHA_CUNG_CAP") {
               try {
                   // 🌟 FIX LỖI "Invalid number": Chuyển đổi mã "PN..." sang ID số trước khi gọi API chi tiết
                   const pnMatch = danhSachPN.find(p => String(p.MaPhieu) === String(maGocActual));
                   const pnIdActual = pnMatch?.MaPhieuNhap || pnMatch?.id || maGocActual;

                   const res = await axios.get(`http://localhost:3000/phieunhap/chitiet/${pnIdActual}`, { headers });
                   if (res.data && res.data.success) {
                       const oData = res.data.data || res.data;
                       originalTicketItems = Array.isArray(oData) ? oData : (oData.ChiTiet || oData.chiTiet || []);
                   }
               } catch (e) { console.error("Lỗi gọi API Phiếu Nhập:", e); }
               }
       }

       // 4. LOGIC DỰ PHÒNG: Ưu tiên bảo hành chi tiết, nếu rỗng thì dùng danh sách từ phiếu gốc
       const baseItems = (Array.isArray(warrantyItems) && warrantyItems.length > 0) ? warrantyItems : originalTicketItems;
       console.log("📊 Tổng hợp danh sách hiển thị (Final baseItems):", baseItems);

       const enrichedItems = baseItems.map(item => {
           const currentMaSP = item.MaSanPham || item.maSanPham || item.MaSP || item.MaSPCode || item.masanpham || item.productId || item.id;

           // Tra cứu tên và QR Code từ danh mục sản phẩm tổng
           const productInfo = danhSachSP.find(sp => String(sp.id || sp.MaSanPham || sp.MaSP) === String(currentMaSP));

           // Tìm thông tin đối soát từ phiếu gốc (để lấy Serial/Lô nếu bên Bảo hành bị thiếu)
           const matchingOriginalItem = originalTicketItems.find(oItem =>
               String(oItem.MaSanPham || oItem.MaSP || oItem.masanpham) === String(currentMaSP) &&
               (
                 (item.SoSerial && String(oItem.SoSerial || oItem.serial || "").trim() === String(item.SoSerial).trim()) ||
                 (item.SoLo && String(oItem.SoLo || oItem.lot || "").trim() === String(item.SoLo).trim()) ||
                 (!item.SoSerial && !item.SoLo)
               )
           );

           return {
               ...item,
               TenSanPham: productInfo?.TenSanPham || productInfo?.name || item.TenSanPham || matchingOriginalItem?.TenSanPham || `Sản phẩm #${currentMaSP}`,
               barcode: productInfo?.barcode || productInfo?.Barcode || item.barcode || item.Barcode || matchingOriginalItem?.barcode || matchingOriginalItem?.Barcode || "—",
               QRCode: productInfo?.qrCode || productInfo?.QRCode || item.qrCode || item.QRCode || matchingOriginalItem?.qrCode || matchingOriginalItem?.QRCode || "—",
               SoLuong: item.SoLuong || item.soLuong || item.SoSanPham || item.Quantity || matchingOriginalItem?.SoLuong || 0,
               SoSerial: item.SoSerial || item.serial || matchingOriginalItem?.SoSerial || "—",
               SoLo: item.SoLo || item.lot || matchingOriginalItem?.SoLo || "—",
               HanBaoHanh: item.HanBaoHanh || item.HanBaoHanh_KhachHang || item.HanBaoHanh_NCC || slip.HanBaoHanh || "N/A"
           };
       });

       setItemsInSlip(enrichedItems);
    } catch (err) {
       console.error("Lỗi tải chi tiết phiếu bảo hành:", err);
       setItemsInSlip([]);
    } finally {
       setLoadingDetail(false);
    }
  };

  // ==========================================
  // 3. XỬ LÝ LƯU PHIẾU TỔNG (POST /phieubaohanh/taomoi)
  // ==========================================
  const handleFinalSubmit = async () => {
    if (!maChungTuGoc) return alert("Vui lòng chọn chứng từ gốc (Phiếu nhập/xuất)!");

    // 🛡️ BƯỚC 0: KIỂM TRA TRẠNG THÁI PHÊ DUYỆT CỦA CHỨNG TỪ GỐC
    const ticketList = loaiChungTuGoc === "EXPORT" ? danhSachPX : danhSachPN;
    const selectedTicket = ticketList.find(t => String(t.MaPhieu) === String(maChungTuGoc));

    if (!selectedTicket || (selectedTicket.TrangThai !== "DaDuyet" && selectedTicket.TrangThai !== "Đã duyệt")) {
      return alert("Chỉ có thể kích hoạt bảo hành cho các phiếu đã được phê duyệt!");
    }
    // -----------------------------------------------------------

    // 🛡️ CHẶN KÍCH HOẠT TRÙNG LẶP TỪ TẦNG LOGIC
    if (activatedDocCodes.has(String(maChungTuGoc))) {
      return alert(`Lỗi logic: Chứng từ ${maChungTuGoc} đã được kích hoạt bảo hành trước đó. Hệ thống không cho phép tạo trùng hồ sơ!`);
    }

    if (!maDoiTac) return alert("Vui lòng chọn Đối tác (Khách hàng/NCC)!");

    try {
      setModalLoading(true);

      // BƯỚC 1: Tự động tạo các bản ghi Bảo hành cho toàn bộ item trong phiếu
      const ticketList = loaiChungTuGoc === "EXPORT" ? danhSachPX : danhSachPN;
      const ticketHeader = ticketList.find(t => String(t.MaPhieu || t.MaPhieuXuat) === String(maChungTuGoc));
      const baseDate = (loaiChungTuGoc === "EXPORT" ? ticketHeader?.NgayXuat : ticketHeader?.NgayNhap) || ngayTaoPhieu;
      const calculatedExpiryDate = calculateExpiry(baseDate);

      // 🌟 Cập nhật theo yêu cầu BE: Phân tách rõ ID Xuất và ID Nhập
      const exportId = loaiChungTuGoc === "EXPORT" ? (ticketHeader?.MaPhieuXuat || ticketHeader?.id) : undefined;
      const importId = loaiChungTuGoc === "IMPORT" ? (ticketHeader?.MaPhieuNhap || ticketHeader?.id) : undefined;

      const createItemPromises = itemsFromTicket.map(item => {
        const qty = Number(item.SoLuong || item.Quantity || 1);
        return axios.post("http://localhost:3000/baohanh/taomoi", {
          MaSanPham: item.MaSanPham,
          MaKho: Number(item.MaKho || 1),
          MaNCC: loaiChungTuGoc === "IMPORT" ? Number(maDoiTac) : undefined,
          // 🌟 Gửi payload chuẩn hóa mới
          MaPhieuXuat: exportId,
          MaPhieuNhap: importId,
          MaPhieu: loaiChungTuGoc === "EXPORT" ? maChungTuGoc : undefined, // Fallback nếu BE cần
          TinhTrangLoi: "Kích hoạt bảo hành theo phiếu " + maChungTuGoc,
          LoaiBaoHanh: "Sửa chữa",
          HanBaoHanh: calculatedExpiryDate,
          TrangThai: "ChoBaoHanh",
          SoLuong: qty, 
          DanhSachSerial: item.SoSerial ? [item.SoSerial] : []
        }, { headers });
      });

      const itemResponses = await Promise.all(createItemPromises);
      const allWarrantyIds = itemResponses.flatMap(res => res.data.data.map(i => i.MaBaoHanh || i.id));

      // BƯỚC 2: Lưu phiếu tổng
      const payload = {
        LoaiPhieuBH: loaiPhieuBH, // "KHACH_HANG" hoặc "NHA_CUNG_CAP"
        MaDoiTac: Number(maDoiTac),
        SoHopDong: soHopDong,
        GhiChuTongQuat: ghiChuTongQuat,
        NgayTaoPhieu: ngayTaoPhieu,
        DanhSachMaBaoHanh: allWarrantyIds,
        MaPhieuGoc: maChungTuGoc, // Gửi kèm mã chứng từ gốc để Backend lưu vết song song
        HanBaoHanh: calculatedExpiryDate // Thêm ngày hết hạn vào phiếu tổng
      };

      const res = await axios.post("http://localhost:3000/phieubaohanh/taomoi", payload, { headers });

      if (res.data.success) {
        alert("✨ Lập phiếu bảo hành thành công! Mã phiếu: " + (res.data.MaPhieu || "OK"));
        setMaDoiTac("");
        setSoHopDong("");
        setGhiChuTongQuat("");
        setMaChungTuGoc("");
        setItemsFromTicket([]);
        setIsCreateModalOpen(false);
        fetchHistory();
      }
    } catch (err) {
      alert("❌ Lỗi lập phiếu tổng: " + (err.response?.data?.message || "Hệ thống bị gián đoạn"));
    } finally {
      setModalLoading(false);
    }
  };

  // --- CẤU HÌNH CỘT LỊCH SỬ ---
  const historyColumns = [
    {
      key: "MaPhieuBH",
      label: "Mã Phiếu BH",
      render: (v, row) => <span className="font-mono font-bold text-blue-600">#{v || row.MaPhieu || row.id}</span>
    },
    {
      key: "LoaiPhieuBH",
      label: "Loại Hình",
      render: (v) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          v === "KHACH_HANG" ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-purple-50 text-purple-600 border-purple-100 whitespace-nowrap"
        }`}>
          {v === "KHACH_HANG" ? "KHÁCH HÀNG" : "NHÀ CUNG CẤP"}
        </span>
      )
    },
    {
      key: "MaPXPN",
      label: "Mã phiếu",
      render: (_, row) => {
        const maGoc = row.MaPXPN_Detected || "N/A";
        const isExportDoc = String(maGoc).toUpperCase().startsWith('PX');
        const isImportDoc = String(maGoc).toUpperCase().startsWith('PN');
        const prefix = isExportDoc ? "Xuất:" : (isImportDoc ? "Nhập:" : "Gốc:");

        const colorClass = row.LoaiPhieuBH === "KHACH_HANG"
          ? "text-orange-600 bg-orange-50 border-orange-100"
          : row.LoaiPhieuBH === "NHA_CUNG_CAP"
            ? "text-blue-600 bg-blue-50 border-blue-100"
            : "text-indigo-600 bg-indigo-50 border-indigo-100";
        return <span className={`whitespace-nowrap text-[10px] font-bold ${colorClass} px-2 py-0.5 rounded border`}>{prefix} {maGoc}</span>;
      }
    },
    {
      key: "TenDoiTac",
      label: "Đối Tác",
      render: (v, row) => {
        const partner = row.LoaiPhieuBH === "KHACH_HANG"
          ? danhSachKH.find(k => String(k.MaKH) === String(row.MaDoiTac))
          : danhSachNCC.find(n => String(n.MaNCC) === String(row.MaDoiTac));
        return <span className="font-semibold text-gray-700">{partner?.TenKH || partner?.TenNCC || v || row.MaDoiTac}</span>;
      }
    },
    {
      key: "NgayTaoPhieu",
      label: "Ngày Lập",
      render: (v) => <span className="text-gray-500">{new Date(v).toLocaleDateString("vi-VN")}</span>
    },
{
  key: "HanBaoHanh",
  label: "Ngày hết hạn BH",
      render: (v) => {
        const rawDate = v; // v đã là HanBaoHanh từ historyNormalized
    if (!rawDate || rawDate === "N/A" || rawDate === "—") {
      return (
        <span className="text-gray-300 italic text-[11px]">
          Chưa xác định
        </span>
      );
    }

    const d = new Date(rawDate);

    if (isNaN(d.getTime())) {
      return (
        <span className="text-gray-300 italic text-[11px]">
          Chưa xác định
        </span>
      );
    }

    const now = new Date();
    const isExpired = d < now;
    const isExpiringSoon =
      !isExpired &&
      d - now < 30 * 24 * 60 * 60 * 1000;

    return (
      <span
        className={`font-bold text-sm ${
          isExpired
            ? "text-red-500"
            : isExpiringSoon
            ? "text-orange-500"
            : "text-gray-700"
        }`}
      >
        {d.toLocaleDateString("vi-VN")}
      </span>
    );
  },
},
{
  key: "ThoiHanConLai",
  label: "Thời hạn còn lại",
      render: (_, row) => {
        const hanBH = row.HanBaoHanh; // Lấy giá trị HanBaoHanh từ đối tượng row
        if (!hanBH || hanBH === "N/A" || hanBH === "—") {
          return <span className="text-gray-300">—</span>;
        }

        const d = new Date(hanBH);

        if (isNaN(d.getTime())) {
          return <span className="text-gray-300">—</span>;
        }

        const isExpired = d < new Date();

        return (
          <span
            className={`font-medium text-xs ${isExpired ? "text-red-400" : "text-blue-600"}`}
          >
            {getRemainingTime(hanBH)} {/* Truyền hanBH vào hàm getRemainingTime */}
          </span>
        );
      },
},
    {
      key: "Status",
      label: "Tình trạng",
      render: (_, row) => {
        const hanBH = row.HanBaoHanh ? new Date(row.HanBaoHanh) : null;
        const now = new Date();
        const isExpired = hanBH && hanBH < now;
        const isExpiringSoon = hanBH && !isExpired && (hanBH - now) < 30 * 24 * 60 * 60 * 1000;

        return (
          <div className="flex flex-col">
            {isExpired ? (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full w-fit">HẾT HẠN</span>
            ) : isExpiringSoon ? (
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full w-fit">SẮP HẾT HẠN</span>
            ) : (
              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full w-fit whitespace-nowrap">ĐANG HIỆU LỰC</span>
            )}
          </div>
        );
      }
    },
    {
      key: "SoLuong",
      label: "Số lượng",
      render: (v, row) => {
        // Đồng bộ logic lấy số lượng giống phiếu Nhập/Xuất:
        // Ưu tiên các trường tổng hợp từ Backend, nếu không có mới fallback về đếm mảng ID
        const count = row.SoLuong || row.soLuong || row.SoSanPham || row.TongSoLuong || v || (Array.isArray(row.DanhSachMaBaoHanh) ? row.DanhSachMaBaoHanh.length : 0);
        return <span className="font-bold text-gray-700">{count}</span>;
      }
    },
    {
      key: "actions",
      label: "Thao tác",
      render: (_, row) => (
        <button onClick={() => handleOpenDetail(row)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all">
          <Eye size={16}/>
        </button>
      )
    }
  ];

  // 🌟 MỚI: Chuẩn hóa dữ liệu toàn cục để dùng cho cả Thẻ KPI và Bảng dữ liệu
  const historyNormalized = useMemo(() => {
    return historyList.map(item => {
      const candidates = [
        item.MaPhieuXuatHienThi, item.MaPhieuNhapHienThi, item.MaPhieuGoc, item.maPhieuGoc,
        item.MaPX, item.maPX, item.MaPN, item.maPN, item.MaPhieuXuat, item.maPhieuXuat,
        item.MaPhieuNhap, item.maPhieuNhap, item.MaPhieu, item.maPhieu
      ];
      const maGocDetected = candidates.find(c => typeof c === 'string' && c !== "Lẻ" && (c.toUpperCase().startsWith('PX') || c.toUpperCase().startsWith('PN')));

      // 🛡️ CHUẨN HÓA QUAN TRỌNG: Gom tất cả các key ngày hết hạn về một mối
      let finalHanBH = item.HanBaoHanh || item.hanBaoHanh || item.HanBH || item.HanBaoHanh_KhachHang || item.HanBaoHanh_NCC;

      return {
        ...item,
        MaPXPN_Detected: maGocDetected || (item.MaPhieuGoc !== "Lẻ" ? item.MaPhieuGoc : "Hồ sơ lẻ"),
        HanBaoHanh: finalHanBH
      };
    });
  }, [historyList]);

  const filteredHistory = useMemo(() => {
    const now = new Date();

    return historyNormalized.filter(item => {
      const isExport = item.LoaiPhieuBH === "KHACH_HANG";
      const isImport = item.LoaiPhieuBH === "NHA_CUNG_CAP";
      const matchesTab = activeHistoryTab === "EXPORT" ? isExport : isImport;

      // 🔍 TÌM KIẾM THÔNG MINH: Quét qua mọi trường mã phiếu và mã đã nhận diện
      const searchLower = searchTermHistory.toLowerCase();
      const matchesSearch = String(item.MaPhieuBH || "").toLowerCase().includes(searchLower) ||
        String(item.MaPhieu || "").toLowerCase().includes(searchLower) ||
        String(item.MaPhieuXuatHienThi || "").toLowerCase().includes(searchLower) ||
        String(item.MaPhieuNhapHienThi || "").toLowerCase().includes(searchLower) ||
        String(item.MaPXPN_Detected || "").toLowerCase().includes(searchLower) ||
        String(item.MaPhieuGoc || "").toLowerCase().includes(searchLower) ||
        String(item.MaPX || "").toLowerCase().includes(searchLower) ||
        String(item.MaPN || "").toLowerCase().includes(searchLower) ||
        String(item.MaPhieuXuat || "").toLowerCase().includes(searchLower) ||
        String(item.MaPhieuNhap || "").toLowerCase().includes(searchLower) ||
        String(item.TenDoiTac || "").toLowerCase().includes(searchTermHistory.toLowerCase());

      // Lọc theo khoảng ngày
      const ngayLap = item.NgayTaoPhieu ? new Date(item.NgayTaoPhieu).toISOString().split('T')[0] : "";
      const matchesStartDate = !startDateFilter || (ngayLap >= startDateFilter);
      const matchesEndDate = !endDateFilter || (ngayLap <= endDateFilter);

      // Tính toán ngày hết hạn để lọc KPI
      const hanBH = item.HanBaoHanh ? new Date(item.HanBaoHanh) : null;
      const matchesKpi = activeKpiFilter === "" ||
        (activeKpiFilter === "ACTIVE" && (!hanBH || hanBH >= now)) ||
        (activeKpiFilter === "EXPIRING" && hanBH && (hanBH - now) > 0 && (hanBH - now) < 30 * 24 * 60 * 60 * 1000) ||
        (activeKpiFilter === "ALL_MACHINES") ||
        (activeKpiFilter === "DANGER" && hanBH && hanBH < now);

      // 🌟 TỐI ƯU: Nếu đang bật lọc KPI (như Đang hiệu lực, Hết hạn...), ta cho phép xem xuyên Tab
      // để khớp với con số hiển thị trên Card KPI (vì Card KPI tính tổng toàn cục)
      const isKpiActive = activeKpiFilter !== "" && activeKpiFilter !== "ALL_MACHINES";
      const finalMatchesTab = (activeKpiFilter === "ALL_MACHINES" || isKpiActive) ? true : matchesTab;

      return matchesSearch && matchesKpi && finalMatchesTab && matchesStartDate && matchesEndDate;
    });
  }, [historyNormalized, searchTermHistory, activeKpiFilter, activeHistoryTab, startDateFilter, endDateFilter]);

  // 🛡️ LOGIC ĐỐI SOÁT: Tập hợp các mã PX/PN đã có hồ sơ bảo hành để ngăn chặn kích hoạt lại
  const activatedDocCodes = useMemo(() => {
    return new Set(historyList.map(item => {
      const candidates = [
        item.MaPhieuXuatHienThi, item.MaPhieuNhapHienThi,
        item.MaPhieuGoc, item.maPhieuGoc,
        item.MaPX, item.maPX, item.MaPN, item.maPN,
        item.MaPhieuXuat, item.maPhieuXuat, item.MaPhieuNhap, item.maPhieuNhap,
        item.MaPhieu, item.maPhieu
      ];
      const maGoc = candidates.find(c =>
        typeof c === 'string' && c !== "Lẻ" && (c.toUpperCase().startsWith('PX') || c.toUpperCase().startsWith('PN'))
      );
      return maGoc || item.MaPhieuGoc;
    }).filter(id => id && id !== "Lẻ"));
  }, [historyList]);

  // 🔢 TOÁN TỬ PHÂN TRANG
  const totalItems = filteredHistory.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const indexOfLastItem = activePage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedHistory = filteredHistory.slice(indexOfFirstItem, indexOfLastItem);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSetPage = (page) => {
    const targetPage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(targetPage);
    setPageInput(String(targetPage));
  };

  const handlePageInputBlurOrEnter = (e) => {
    if (e.key && e.key !== "Enter") return;
    let targetPage = parseInt(pageInput, 10);
    if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
    if (targetPage > totalPages) targetPage = totalPages;
    handleSetPage(targetPage);
  };

  // Hàm tiện ích tính tổng máy để tránh lặp code và sai lệch
  const calculateTotalMachines = (list) => {
    return list.reduce((sum, p) => sum + (Number(p.SoLuong || p.SoSanPham || p.TongSoLuong) || 0), 0);
  };

  return (
    <MainLayout role={role}>
      <div className="space-y-6">
        {/* TIÊU ĐỀ & NÚT TÁC VỤ */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Quản lý Hồ sơ Bảo hành</h2>
            <p className="text-sm text-gray-400 mt-1">Tra cứu thời hạn và kích hoạt bảo hành song hành cùng chứng từ kho</p>
          </div>

          {activeKpiFilter && (
            <button
              onClick={() => setActiveKpiFilter("")}
              className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1 rounded-full font-bold hover:bg-amber-100 transition-all animate-pulse"
            >
              ✕ Đang lọc theo thẻ KPI (Bấm để hủy)
            </button>
          )}

          <div className="flex gap-2">
            <button
              onClick={fetchHistory}
              className="bg-white border border-gray-200 text-gray-500 px-4 py-2 text-xs font-bold rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <RefreshCcw size={14} className={loadingHistory ? "animate-spin" : ""}/> Làm mới
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 text-white px-6 py-2 text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2"
            >
              <FilePlus size={16}/> + Kích Hoạt Bảo Hành Mới
            </button>
          </div>
        </div>

        {/* KPI STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* KPI CARDS: Cập nhật hiển thị số lượng máy (Items) thay vì chỉ đếm số phiếu (Slips) */}
          <div
            onClick={() => setActiveKpiFilter(prev => prev === "ALL_MACHINES" ? "" : "ALL_MACHINES")}
            className={`cursor-pointer transition-all hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-xs ${activeKpiFilter === "ALL_MACHINES" ? "border-blue-500 ring-2 ring-blue-500/10 shadow-sm" : "border-gray-100"}`}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><History size={20}/></div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Tổng số máy BH</p>
              <h3 className="text-xl font-bold text-gray-800">{calculateTotalMachines(historyNormalized)}</h3>
            </div>
          </div>

          <div
            onClick={() => { setActiveHistoryTab("EXPORT"); setActiveKpiFilter(""); }}
            className={`cursor-pointer transition-all hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${activeHistoryTab === "EXPORT" ? "border-orange-500 ring-2 ring-orange-500/10 shadow-sm" : "border-gray-100"}`}
          >
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600"><FileOutput size={20}/></div>
            <div><p className="text-[10px] font-bold text-gray-400 uppercase">Máy từ PX</p><h3 className="text-xl font-bold text-orange-600">{calculateTotalMachines(historyNormalized.filter(p => p.LoaiPhieuBH === "KHACH_HANG"))}</h3></div>
          </div>

          <div
            onClick={() => { setActiveHistoryTab("IMPORT"); setActiveKpiFilter(""); }}
            className={`cursor-pointer transition-all hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-xs ${activeHistoryTab === "IMPORT" ? "border-emerald-500 ring-2 ring-emerald-500/10 shadow-sm" : "border-gray-100"}`}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><FileInput size={20}/></div>
            <div><p className="text-[10px] font-bold text-gray-400 uppercase">Máy từ PN</p><h3 className="text-xl font-bold text-emerald-600">{calculateTotalMachines(historyNormalized.filter(p => p.LoaiPhieuBH === "NHA_CUNG_CAP"))}</h3></div>
          </div>

          <div
            onClick={() => setActiveKpiFilter(prev => prev === "ACTIVE" ? "" : "ACTIVE")}
            className={`cursor-pointer transition-all hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-xs ${activeKpiFilter === "ACTIVE" ? "border-emerald-500 ring-2 ring-emerald-500/10 shadow-sm" : "border-gray-100"}`}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><CheckCircle size={20}/></div>
            <div><p className="text-[10px] font-bold text-gray-400 uppercase">Đang hiệu lực</p><h3 className="text-xl font-bold text-emerald-600">{calculateTotalMachines(historyNormalized.filter(p => !p.HanBaoHanh || new Date(p.HanBaoHanh) >= new Date()))}</h3></div>
          </div>

          <div
            onClick={() => setActiveKpiFilter(prev => prev === "EXPIRING" ? "" : "EXPIRING")}
            className={`cursor-pointer transition-all hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-xs ${activeKpiFilter === "EXPIRING" ? "border-amber-500 ring-2 ring-amber-500/10 shadow-sm" : "border-gray-100"}`}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Timer size={20}/></div>
            <div><p className="text-[10px] font-bold text-gray-400 uppercase">Sắp hết hạn</p><h3 className="text-xl font-bold text-amber-600">{calculateTotalMachines(historyNormalized.filter(p => p.HanBaoHanh && (new Date(p.HanBaoHanh) - new Date()) > 0 && (new Date(p.HanBaoHanh) - new Date()) < 30 * 24 * 60 * 60 * 1000))}</h3></div>
          </div>

          <div
            onClick={() => setActiveKpiFilter(prev => prev === "DANGER" ? "" : "DANGER")}
            className={`cursor-pointer transition-all hover:scale-[1.02] bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-xs ${activeKpiFilter === "DANGER" ? "border-red-500 ring-2 ring-red-500/10 shadow-sm" : "border-gray-100"}`}
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600"><ShieldAlert size={20}/></div>
            <div><p className="text-[10px] font-bold text-gray-400 uppercase">Hết hạn BH</p><h3 className="text-xl font-bold text-red-600">{calculateTotalMachines(historyNormalized.filter(p => p.HanBaoHanh && new Date(p.HanBaoHanh) < new Date()))}</h3></div>
          </div>
        </div>

        {/* NAVIGATION TABS CHO LỊCH SỬ HỒ SƠ */}
        <div className="flex border-b border-gray-200 bg-white p-2 rounded-xl shadow-xs gap-2">
          <button
            onClick={() => setActiveHistoryTab("EXPORT")}
            className={`flex-1 sm:flex-none px-6 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeHistoryTab === "EXPORT" ? "bg-orange-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <FileOutput size={14}/> 1. HỒ SƠ THEO PHIẾU XUẤT
          </button>
          <button
            onClick={() => setActiveHistoryTab("IMPORT")}
            className={`flex-1 sm:flex-none px-6 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeHistoryTab === "IMPORT" ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <FileInput size={14}/> 2. HỒ SƠ THEO PHIẾU NHẬP
          </button>
        </div>

        {/* BẢNG DỮ LIỆU CHÍNH */}
        <div className="space-y-4 animate-in fade-in duration-500">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tìm kiếm hồ sơ bảo hành</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                <input
                  type="text"
                  placeholder="Mã phiếu (PX/PN), mã hồ sơ, tên đối tác..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                  value={searchTermHistory}
                  onChange={(e) => setSearchTermHistory(e.target.value)}
                />
                {searchTermHistory && (
                  <button type="button" onClick={() => setSearchTermHistory("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm font-bold">×</button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Từ ngày</label>
              <input
                type="date"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Đến ngày</label>
              <input
                type="date"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
              />
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
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
            {loadingHistory ? (
              <div className="flex items-center justify-center p-24 text-gray-400 gap-2"><Loader2 className="animate-spin" size={24}/> Đang nạp danh sách hồ sơ...</div>
            ) : (
              <DataTable
                columns={historyColumns}
                data={paginatedHistory}
              />
            )}
          </div>
        </div>

        {/* 🔢 THANH PHÂN TRANG TIỆN ÍCH */}
        {!loadingHistory && totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-500">
            <div>
              Hiển thị từ <span className="font-bold text-gray-800">{indexOfFirstItem + 1}</span> -{" "}
              <span className="font-bold text-gray-800">{Math.min(indexOfLastItem, totalItems)}</span> trên{" "}
              <span className="font-bold text-gray-800">{totalItems}</span> hồ sơ
            </div>

            <div className="flex items-center space-x-2">
              <button disabled={activePage === 1} onClick={() => setCurrentPage(1)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all font-medium text-xs">« Đầu</button>
              <button disabled={activePage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all font-medium text-xs">‹ Trước</button>

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

              <button disabled={activePage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all font-medium text-xs">Sau ›</button>
              <button disabled={activePage === totalPages} onClick={() => setCurrentPage(totalPages)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all font-medium text-xs">Cuối »</button>
            </div>
          </div>
        )}

        {/* ==========================================
            MODAL 1: KÍCH HOẠT BẢO HÀNH MỚI (THÔNG MINH)
           ========================================== */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-gray-50 rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
              <div className="px-8 py-5 bg-white border-b flex justify-between items-center shrink-0">
                 <div>
                    <h3 className="text-xl font-black text-gray-800 flex items-center gap-2"><ShieldCheck className="text-blue-600"/> LẬP HỒ SƠ KÍCH HOẠT BẢO HÀNH</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Hệ thống tự động trích xuất thông tin từ chứng từ gốc PX/PN</p>
                 </div>
                 <button onClick={() => setIsCreateModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all text-2xl">&times;</button>
              </div>

              <div className="p-8 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Phần cấu hình bên trái */}
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-5">
                    <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-widest border-b pb-2">Bước 1: Nguồn chứng từ</h4>
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                      <button onClick={() => {setLoaiChungTuGoc("EXPORT"); setMaChungTuGoc(""); setTicketSearchTerm("");}} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${loaiChungTuGoc === "EXPORT" ? "bg-white text-blue-600 shadow-sm" : "text-gray-400"}`}>PHIẾU XUẤT (BÁN)</button>
                      <button onClick={() => {setLoaiChungTuGoc("IMPORT"); setMaChungTuGoc(""); setTicketSearchTerm("");}} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${loaiChungTuGoc === "IMPORT" ? "bg-white text-emerald-600 shadow-sm" : "text-gray-400"}`}>PHIẾU NHẬP (MUA)</button>
                    </div>

                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Tìm nhanh mã phiếu hoặc đối tác..."
                        className="w-full pl-10 pr-4 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none bg-gray-50/50 font-medium"
                        value={ticketSearchTerm}
                        onChange={(e) => setTicketSearchTerm(e.target.value)}
                      />
                      {ticketSearchTerm && (
                        <button type="button" onClick={() => setTicketSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm font-bold">×</button>
                      )}
                    </div>

                    {/* 🌟 CẢI TIẾN: Danh sách kết quả chọn nhanh (Thay thế Select cũ) */}
                    <div className="max-h-[220px] overflow-y-auto border border-gray-100 rounded-2xl bg-gray-50/50 p-2 space-y-1.5 scrollbar-thin">
                      {filteredTicketsForSelect.length === 0 ? (
                        <div className="py-6 text-center">
                          <p className="text-[10px] text-gray-400 italic">Không tìm thấy mã phiếu nào khớp với từ khóa...</p>
                        </div>
                      ) : (
                        filteredTicketsForSelect.map(t => {
                          const isAlreadyActivated = activatedDocCodes.has(String(t.MaPhieu));
                          const isSelected = String(maChungTuGoc) === String(t.MaPhieu);

                          let partnerName = "";
                          if (loaiChungTuGoc === "EXPORT") {
                            partnerName = t.TenKH || danhSachKH.find(k => String(k.MaKH) === String(t.MaKH))?.TenKH || `KH #${t.MaKH}`;
                          } else {
                            partnerName = t.TenNCC || danhSachNCC.find(n => String(n.MaNCC) === String(t.MaNCC))?.TenNCC || `NCC #${t.MaNCC}`;
                          }

                          return (
                            <button
                              key={t.MaPhieu}
                              type="button"
                              disabled={isAlreadyActivated || (t.TrangThai !== "DaDuyet" && t.TrangThai !== "Đã duyệt")}
                              onClick={() => {
                                // Cảnh báo nếu cố tình click vào phiếu chưa duyệt (dù đã bị ẩn khỏi danh sách)
                                if (t.TrangThai !== "DaDuyet" && t.TrangThai !== "Đã duyệt") {
                                  alert("Chỉ có thể chọn các phiếu đã được phê duyệt để kích hoạt bảo hành.");
                                  return;
                                }
                                setMaChungTuGoc(t.MaPhieu);
                                setTicketSearchTerm(""); // Tự động xóa text search để giao diện gọn gàng sau khi chọn
                              }}
                              className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between group ${
                                isSelected
                                  ? "bg-blue-600 border-blue-600 text-white shadow-lg ring-2 ring-blue-500/20"
                                  : (isAlreadyActivated || (t.TrangThai !== "DaDuyet" && t.TrangThai !== "Đã duyệt"))
                                    ? "bg-gray-100 border-transparent opacity-50 cursor-not-allowed"
                                    : "bg-white border-gray-100 hover:border-blue-300 hover:shadow-sm"
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className={`text-xs font-black ${isSelected ? "text-white" : "text-gray-800"}`}>Mã: {t.MaPhieu}</span>
                                <span className={`text-[10px] font-bold truncate max-w-[220px] ${isSelected ? "text-blue-100" : "text-gray-400 group-hover:text-blue-500"}`}>{partnerName}</span>
                              </div>
                              {isAlreadyActivated ? ( // Nếu đã kích hoạt
                                <span className="text-[8px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase">Đã lập hồ sơ</span>
                              ) : (t.TrangThai !== "DaDuyet" && t.TrangThai !== "Đã duyệt") ? ( // Nếu chưa duyệt
                                <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full uppercase">Chưa duyệt</span>
                              ) : isSelected ? (
                                <CheckCircle size={16} className="text-white animate-in zoom-in"/>
                              ) : (
                                <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all"/>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                    {maChungTuGoc && activatedDocCodes.has(String(maChungTuGoc)) && (
                      <p className="text-[10px] text-red-600 font-bold mt-1.5 animate-pulse">⚠️ Chứng từ này đã kích hoạt bảo hành, không thể thực hiện lại!</p>
                    )}
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <h4 className="text-[11px] font-black text-orange-600 uppercase tracking-widest border-b pb-2">Bước 2: Thời hạn áp dụng</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Độ dài</label>
                        <input type="number" min="1" value={warrantyValue} onChange={(e) => setWarrantyValue(e.target.value)} className="w-full font-bold rounded-xl border border-gray-200 px-3 py-2.5 text-center text-blue-600"/>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Đơn vị</label>
                        <select value={warrantyUnit} onChange={(e) => setWarrantyUnit(e.target.value)} className="w-full font-bold rounded-xl border border-gray-200 px-3 py-2.5 bg-gray-50">
                          <option value="MONTH">Tháng</option>
                          <option value="YEAR">Năm</option>
                        </select>
                      </div>
                    </div>
                    {maChungTuGoc && (
                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 animate-pulse">
                        <p className="text-[10px] text-blue-700 font-bold uppercase">Ngày hết hạn dự kiến:</p>
                        <p className="text-lg font-black text-blue-800 mt-1">
                          {currentExpiryPreview ? new Date(currentExpiryPreview).toLocaleDateString("vi-VN") : "—"}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                    <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest border-b pb-2">Bước 3: Ghi chú phiếu</h4>
                    <textarea
                      rows="3"
                      placeholder="Mô tả nội dung hồ sơ..."
                      value={ghiChuTongQuat}
                      onChange={(e) => setGhiChuTongQuat(e.target.value)}
                      className="w-full text-xs font-medium rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                </div>

                {/* Phần bảng hàng hóa bên phải */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col min-h-[450px]">
                   <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
                      <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2"><Package size={16} className="text-blue-500"/> Nội dung hàng hóa bảo hành</h4>
                      <span className="text-[10px] font-bold bg-white border px-3 py-1 rounded-full text-gray-500">{itemsFromTicket.length} Mặt hàng được phát hiện</span>
                   </div>

                   <div className="flex-1 p-2 overflow-x-auto">
                      {loadingItems ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 italic"><Loader2 className="animate-spin text-blue-500"/> Đang bóc tách dữ liệu từ chứng từ...</div>
                      ) : itemsFromTicket.length > 0 ? (
                        <table className="w-full text-xs text-left">
                           <thead>
                              <tr className="text-gray-400 font-black uppercase text-[10px] border-b">
                                 <th className="p-4">Sản phẩm</th>
                                 <th className="p-4">Barcode</th>
                                 <th className="p-4 text-center">Số lượng</th>
                                 <th className="p-4 text-center">Hết hạn dự kiến</th>
                                 <th className="p-4 text-right">Trạng thái BH</th>
                              </tr>
                           </thead>
                           <tbody>
                              {itemsFromTicket.map((item, idx) => (
                                <tr key={idx} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                   <td className="p-4 font-bold text-gray-800">{item.TenSanPham || `SP #${item.MaSanPham}`}</td>
                                   <td className="p-4 font-mono text-blue-600 font-bold">{item.barcode || "—"}</td>
                                   <td className="p-4 text-center font-black text-gray-500">{item.SoLuong}</td>
                                   <td className="p-4 text-center font-bold text-blue-600">{currentExpiryPreview ? new Date(currentExpiryPreview).toLocaleDateString("vi-VN") : "—"}</td>
                                   <td className="p-4 text-right"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold text-[9px]">SẴN SÀNG KÍCH HOẠT</span></td>
                                </tr>
                              ))}
                           </tbody>
                        </table>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300">
                           <AlertTriangle size={48} className="opacity-20"/>
                           <p className="text-sm font-medium italic">Vui lòng chọn chứng từ gốc để xem chi tiết hàng hóa</p>
                        </div>
                      )}
                   </div>
                </div>
              </div>

              <div className="px-8 py-5 bg-white border-t flex justify-end gap-3 shrink-0">
                <button onClick={() => setIsCreateModalOpen(false)} className="px-6 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all">Hủy bỏ</button>
                <button
                  onClick={handleFinalSubmit}
                  disabled={modalLoading || !maChungTuGoc || activatedDocCodes.has(String(maChungTuGoc))}
                  className="px-8 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {modalLoading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} XÁC NHẬN KÍCH HOẠT HỆ THỐNG
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            MODAL 2: XEM CHI TIẾT PHIẾU BẢO HÀNH ĐÃ LẬP
           ========================================== */}
        {isDetailModalOpen && selectedSlipDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in duration-200 flex flex-col max-h-[90vh]">
               <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                  {/* Thay thế selectedSlipDetail.MaPhieu thành trường đúng */}
                  <h3 className="font-black text-gray-800">
                    CHI TIẾT PHIẾU BH: <span className="text-blue-600">#{selectedSlipDetail.MaPhieuBH || selectedSlipDetail.id}</span>
                  </h3>
                  <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-gray-800 text-2xl">&times;</button>
               </div>
               <div className="p-6 overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                     <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Đối tác</p>
                        <p className="text-xs font-black text-gray-700 truncate">{selectedSlipDetail.TenDoiTac || "N/A"}</p>
                     </div>
                     <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Ngày lập hồ sơ</p>
                        <p className="text-xs font-black text-gray-700">{new Date(selectedSlipDetail.NgayTaoPhieu).toLocaleDateString("vi-VN")}</p>
                     </div>
                     <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Hợp đồng liên quan</p>
                        <p className="text-xs font-black text-gray-700">{selectedSlipDetail.SoHopDong || "KHÔNG CÓ"}</p>
                     </div>
                     <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Loại hình</p>
                        <p className="text-xs font-black text-blue-600 uppercase">{selectedSlipDetail.LoaiPhieuBH}</p>
                     </div>
                  </div>

                  {/* 🌟 BỔ SUNG: Hiển thị ghi chú tổng quát của hồ sơ bảo hành */}
                  {selectedSlipDetail.GhiChuTongQuat && (
                     <div className="mb-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                        <p className="text-[9px] font-bold text-blue-600 uppercase mb-1 flex items-center gap-1"><Info size={10}/> Ghi chú hồ sơ</p>
                        <p className="text-xs text-gray-600 italic leading-relaxed">{selectedSlipDetail.GhiChuTongQuat}</p>
                     </div>
                  )}

                  <div className="border rounded-2xl overflow-hidden">
                     <table className="w-full text-xs text-left">
                        <thead className="bg-gray-100 text-gray-500 font-bold uppercase text-[9px]">
                           <tr>
                              <th className="p-3 w-[25%]">Tên sản phẩm</th>
                              <th className="p-3">Mã Barcode</th>
                              <th className="p-3 text-center">SL</th>
                              <th className="p-3">QR Code sản phẩm</th>
                              <th className="p-3 text-center">Ngày hết hạn BH</th>
                              <th className="p-3 text-center">Thời gian còn lại</th>
                              <th className="p-3 text-right">Tình trạng</th>
                           </tr>
                        </thead>
                        <tbody>
                           {loadingDetail ? (
                              <tr><td colSpan="6" className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-500"/></td></tr>
                           ) : itemsInSlip.length > 0 ? (
                              itemsInSlip.map((item, i) => {
                                // Ép kiểu ngày tháng an toàn
                                const rawDate = item.HanBaoHanh || item.HanBaoHanh_KhachHang || item.HanBaoHanh_NCC;
                                const hanBH = (rawDate && rawDate !== "N/A" && rawDate !== "—") ? new Date(rawDate) : null;
                                const now = new Date();
                                const isExpired = hanBH ? hanBH < now : false;
                                const isExpiringSoon = hanBH && !isExpired ? (hanBH - now) < 30 * 24 * 60 * 60 * 1000 : false;
                                return (
                                  <tr key={i} className="border-t hover:bg-gray-50">
                                     <td className="p-3 font-bold text-gray-800 leading-tight">
                                        {item.TenSanPham || `SP #${item.MaSanPham || item.MaSP}`}
                                     </td>
                                     <td className="p-3 font-mono text-[11px] font-bold text-blue-600 break-all">
                                        {item.barcode || "—"}
                                     </td>
                                     <td className="p-3 text-center">
                                        <span className="font-bold text-gray-600">
                                          {item.SoLuong || 0}
                                        </span>
                                     </td>
                                     <td className="p-3">
                                        {item.QRCode && item.QRCode !== "—" ? (
                                          <span className="font-mono text-[10px] text-purple-700 bg-purple-50 border border-purple-100 px-2 py-1 rounded-lg break-all">
                                            {item.QRCode}
                                          </span>
                                        ) : (
                                          <span className="text-gray-300 italic text-[10px]">Chưa có QR Code</span>
                                        )}
                                     </td>
                                     <td className="p-3 text-center font-bold">
                                        {hanBH ? (
                                          <span className={isExpired ? "text-red-500" : isExpiringSoon ? "text-orange-500" : "text-gray-600"}>
                                            {hanBH.toLocaleDateString("vi-VN")}
                                          </span>
                                        ) : "—"}
                                     </td>
                                     <td className="p-3 text-center font-medium text-blue-600">
                                        {hanBH ? getRemainingTime(hanBH) : "—"}
                                     </td>
                                     <td className="p-3 text-right">
                                        {!hanBH ? (
                                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 text-gray-500">CHƯA XÁC ĐỊNH</span>
                                        ) : isExpired ? (
                                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700">HẾT HẠN</span>
                                        ) : isExpiringSoon ? (
                                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-orange-700">SẮP HẾT HẠN</span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-100 text-green-700">CÒN BẢO HÀNH</span>
                                        )}
                                     </td>
                                  </tr>
                                );
                              })
                           ) : (
                              <tr><td colSpan="6" className="p-10 text-center text-gray-400 italic">Hồ sơ này chưa có dữ liệu hàng hóa chi tiết.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
               <div className="p-4 bg-gray-50 border-t flex justify-end">
                  <button onClick={() => setIsDetailModalOpen(false)} className="px-6 py-2 bg-white border rounded-xl text-xs font-bold shadow-sm">Đóng lại</button>
               </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
