import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { getCurrentRole, ROLES } from "../services/auth";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { getProducts } from "../services/productService";
import { getTonKhoItems, mergeProductsWithTonKho, normalizeTonKhoItem } from "../services/tonKhoService";

export default function MainLayout({ role, children }) {
  const activeRole = role || getCurrentRole() || ROLES.staff;
  const location = useLocation();

  // 🌟 ĐÃ THÊM: State quản lý trạng thái đóng/mở Sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Hàm đảo ngược trạng thái Sidebar
  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  async function refreshProducts() {
    if (location.pathname !== "/products") {
      return;
    }

    let cancelled = false;

    try {
      setLoading(true);

      const [productsResult, tonKhoResult] = await Promise.allSettled([
        getProducts(),
        getTonKhoItems(),
      ]);

      if (productsResult.status !== "fulfilled") {
        throw productsResult.reason;
      }

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
        setError(message || "Không thể tải danh sách sản phẩm từ API.");
        setProducts([]);
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }

    return () => {
      cancelled = true;
    };
  }

  useEffect(() => {
    if (location.pathname !== "/products") {
      return;
    }

    const cleanup = refreshProducts();

    return () => {
      cleanup.then((cancel) => cancel?.());
    };
  }, [location.pathname]);

  const renderedChildren = typeof children === "function"
    ? children({ products, loading, error, refreshProducts })
    : children;

return (
  <div className="min-h-screen bg-[#f3f6fb] text-gray-800 antialiased">
    
    {/* 1. SIDEBAR: Quản lý ẩn hiện bằng class cố định width hoặc dịch chuyển */}
    <div
      className={`fixed inset-y-0 left-0 z-30 bg-[#0a2540] transition-all duration-300 transform ${
        isSidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full"
      }`}
    >
      <Sidebar role={activeRole} isVisible={isSidebarOpen} />
    </div>

    {/* 2. KHỐI NỘI DUNG CHÍNH: Tự động dịch lề (Padding Left) mượt mà theo Sidebar */}
    <div 
      className={`min-h-screen flex flex-col transition-all duration-300 ${
        isSidebarOpen ? "pl-64" : "pl-0"
      }`}
    >
      {/* Header nằm trong luồng dịch lề nên sẽ luôn khớp 100% với nội dung bên dưới */}
      <Header role={activeRole} onMenuClick={toggleSidebar} />
      
      {/* Vùng hiển thị các trang con */}
      <main className="p-6 flex-1 w-full max-w-(screen-2xl) mx-auto">
        {renderedChildren}
      </main>
    </div>

    {/* Lớp nền mờ khi bấm trên thiết bị di động (Mobile/Tablet) */}
    {isSidebarOpen && (
      <div 
        onClick={toggleSidebar} 
        className="fixed inset-0 z-20 bg-black/20 lg:hidden"
      />
    )}
  </div>
);
}