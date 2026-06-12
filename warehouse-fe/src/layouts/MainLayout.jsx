import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { ROLES, logout, normalizeUserSession, normalizeRole } from "../services/auth";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { getProducts } from "../services/productService";
import { getTonKhoItems, mergeProductsWithTonKho, normalizeTonKhoItem } from "../services/tonKhoService";

export default function MainLayout({ role, children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // 🛡️ Quản lý User bằng State để tránh nháy menu khi cập nhật thông tin
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? normalizeUserSession(JSON.parse(saved)) : null;
  });

  // 🛡️ ỔN ĐỊNH ROLE: Đối sánh đúng chuỗi chữ để đồng bộ với cấu hình menu
  const activeRole = normalizeRole(role || currentUser?.role || currentUser?.TenVaiTro) || "NhanVien";

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 🔄 Hàm đồng bộ User dữ liệu từ LocalStorage
  const syncUserFromStorage = () => {
    const saved = localStorage.getItem("user");
    if (saved) {
      try {
        const parsed = normalizeUserSession(JSON.parse(saved));
        setCurrentUser(prev => {
          if (JSON.stringify(prev) === JSON.stringify(parsed)) return prev;
          return parsed;
        });
      } catch (e) {
        console.error("Lỗi parse user tại MainLayout:", e);
      }
    }
  };

  useEffect(() => {
    syncUserFromStorage();
    const handleUserUpdate = () => syncUserFromStorage();
    window.addEventListener("user-updated", handleUserUpdate);
    window.addEventListener("storage", handleUserUpdate);
    return () => {
      window.removeEventListener("user-updated", handleUserUpdate);
      window.removeEventListener("storage", handleUserUpdate);
    };
  }, [location.pathname]);

  async function refreshProducts() {
    if (location.pathname !== "/products") return;
    let cancelled = false;

    try {
      setLoading(true);
      const [productsResult, tonKhoResult] = await Promise.allSettled([
        getProducts(),
        getTonKhoItems(),
      ]);

      if (productsResult.status !== "fulfilled") throw productsResult.reason;

      const normalizedTonKho =
        tonKhoResult.status === "fulfilled"
          ? tonKhoResult.value.map(normalizeTonKhoItem)
          : [];

      const mergedProducts = mergeProductsWithTonKho(productsResult.value, normalizedTonKho);

      if (!cancelled) {
        setProducts(mergedProducts);
        setError("");
      }
    } catch (err) {
      if (!cancelled) {
        const message = err?.response?.data?.message || err?.message;
        setError(message || "Không thể tải danh sách sản phẩm.");
        setProducts([]);
      }
    } finally {
      if (!cancelled) setLoading(false);
    }

    return () => { cancelled = true; };
  }

  useEffect(() => {
    if (location.pathname !== "/products") return;
    const cleanup = refreshProducts();
    return () => { cleanup.then((cancel) => cancel?.()); };
  }, [location.pathname]);

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
    if (!token) return;

    let isMounted = true;

    const validateSession = async () => {
      try {
        const response = await axios.get("http://localhost:3000/auth/me", {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          timeout: 10000,
        });

        if (!isMounted) return;

        const serverUser = response?.data?.user || response?.data?.data || null;
        const status = serverUser?.TrangThai ?? serverUser?.TrangThaiTaiKhoan;

        if (status !== undefined && Number(status) === 0) {
          logout();
          navigate("/login", { replace: true });
          return;
        }

        if (serverUser) {
          const normalizedServerUser = normalizeUserSession(serverUser);
          const savedUserStr = localStorage.getItem("user") || "{}";
          const serverUserStr = JSON.stringify(normalizedServerUser);

          if (savedUserStr !== serverUserStr) {
            const oldUser = JSON.parse(savedUserStr);
            localStorage.setItem("user", serverUserStr);
            setCurrentUser(normalizedServerUser);

            window.dispatchEvent(new CustomEvent("user-updated", { detail: normalizedServerUser }));

            if (oldUser && oldUser.MaTaiKhoan) {
              const oldRole = oldUser?.role || oldUser?.TenVaiTro || "";
              const newRole = normalizedServerUser.role || normalizedServerUser.TenVaiTro || "";

              const sortPerms = (perms) => [...(perms || [])].sort((a, b) => (a.MaQuyen || 0) - (b.MaQuyen || 0));
              const oldPermissions = JSON.stringify(sortPerms(oldUser?.QuyenHan));
              const newPermissions = JSON.stringify(sortPerms(normalizedServerUser.QuyenHan));

              if (oldRole !== newRole || oldPermissions !== newPermissions) {
                alert("Quyền hạn đã thay đổi. Vui lòng đăng nhập lại.");
                logout();
                navigate("/login", { replace: true });
                return;
              }
            }
          }
        }
      } catch (error) {
        if (!isMounted) return;
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          logout();
          navigate("/login", { replace: true });
          return;
        }
      }
    };

    validateSession();
    const intervalId = window.setInterval(validateSession, 15000);
    const handleFocus = () => validateSession();

    window.addEventListener("focus", handleFocus);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [location.pathname, navigate]);

  const renderedChildren = typeof children === "function"
    ? children({ products, loading, error, refreshProducts })
    : children;

  // 🌟 CẤU TRÚC LAYOUT THỐNG NHẤT - KHÔNG DI CHUYỂN, KHÔNG THỤT LỀ
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f3f6fb] text-gray-800 antialiased">
      
      {/* 1. SIDEBAR CỐ ĐỊNH CỨNG: Luôn đứng im bên trái, chặn co giãn bằng shrink-0 */}
      <Sidebar role={activeRole} isOpen={isSidebarOpen} />

      {/* 2. KHỐI NỘI DUNG CHÍNH ĐỘC LẬP: Tự động cuộn riêng biệt bên phải */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Header nằm vững vàng trên cùng của khu vực làm việc */}
        <Header
          role={activeRole}
          onMenuClick={() => setIsSidebarOpen(prev => !prev)}
        />
        
        {/* Vùng hiển thị các trang con - Cuộn nội bộ mượt mà không làm giật thanh menu */}
        <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable] p-6 w-full">
          <div className="max-w-screen-2xl mx-auto">
            {renderedChildren}
          </div>
        </main>
      </div>

    </div>
  );
}