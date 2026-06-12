import { Bell, LogOut, Mail, Menu, Search, FileText } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getCurrentUser, logout, normalizeUserSession, ROLES } from "../services/auth";
import { useState, useEffect, useRef, useMemo } from "react";
import { menuByRole } from "../constants/menu";

const SERVER_URL = "http://localhost:3000";

function getAvatarUrl(path, cacheKey) {
  if (!path) return "";

  const normalizedPath = String(path);

  if (/^data:/i.test(normalizedPath)) {
    return normalizedPath;
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return cacheKey 
      ? `${normalizedPath}${normalizedPath.includes("?") ? "&" : "?"}v=${cacheKey}`
      : normalizedPath;
  }

  const baseUrl = `${SERVER_URL}${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`;
  return cacheKey ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}v=${cacheKey}` : baseUrl;
}

export default function Header({
  role = ROLES.staff,
  userName,
  roleName,
  searchPlaceholder,
  onMenuClick, // Thêm prop này để nhận hàm xử lý từ Layout
  onSearch, // Prop mới để xử lý tìm kiếm
  initialSearchTerm = "", // Prop mới cho giá trị tìm kiếm ban đầu
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // 🛡️ LẤY THÔNG TIN USER THỰC TẾ TỪ LOCALSTORAGE ĐỂ HIỂN THỊ ĐÚNG PROFILE
  // 💡 CẢI TIẾN: Khởi tạo state đồng bộ từ localStorage giúp Header có dữ liệu ngay lập tức khi load trang/chuyển trang
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        return normalizeUserSession(JSON.parse(savedUser));
      } catch (e) {
        console.error("Lỗi đọc dữ liệu người dùng tại Header:", e);
      }
    }
    return null;
  });
  const [avatarError, setAvatarError] = useState(false);

  const syncCurrentUser = () => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const parsed = normalizeUserSession(JSON.parse(savedUser));
        setCurrentUser((prev) => {
          // Tránh re-render thừa nếu dữ liệu không đổi
          if (JSON.stringify(prev) === JSON.stringify(parsed)) return prev;
          return parsed;
        });
      } catch (e) {
        console.error("Lỗi đọc dữ liệu người dùng tại Header:", e);
      }
    } else {
      setCurrentUser(null);
    }
  };

  // 🔁 Re-sync mỗi khi component mount, mỗi khi route đổi (sau login luôn navigate sang trang khác)
  // và khi nhận được sự kiện cập nhật user / storage thay đổi.
  useEffect(() => {
    syncCurrentUser();
  }, [location.pathname]);

  useEffect(() => {
    const handleUserUpdated = () => syncCurrentUser();
    const handleStorageUpdated = (event) => {
      if (event.key === "user") {
        syncCurrentUser();
      }
    };

    window.addEventListener("user-updated", handleUserUpdated);
    window.addEventListener("storage", handleStorageUpdated);

    return () => {
      window.removeEventListener("user-updated", handleUserUpdated);
      window.removeEventListener("storage", handleStorageUpdated);
    };
  }, []);

  const info = getCurrentUser(role);

  // Ưu tiên: Props truyền vào > Dữ liệu profile thực tế > Dữ liệu mặc định theo Role
  const displayUserName = userName || currentUser?.TenNhanVien || info.userName;
  const displayRoleName = roleName || currentUser?.TenVaiTro || info.roleName;
  const displaySearchPlaceholder = searchPlaceholder || info.searchPlaceholder;
  
  // 💡 TỐI ƯU: Sử dụng useMemo để tránh tính toán lại URL ảnh và gây flicker (nháy) khi re-render
  const displayAvatarUrl = useMemo(() => {
    const rawAvatar = currentUser?.AnhDaiDien || currentUser?.image || currentUser?.avatar || info.avatarUrl;
    if (!rawAvatar) return null;
    // Chỉ thêm cacheKey (avatarVersion) nếu thực sự có để tránh trình duyệt tải lại ảnh liên tục
    return getAvatarUrl(rawAvatar, currentUser?.avatarVersion);
  }, [currentUser?.AnhDaiDien, currentUser?.image, currentUser?.avatar, currentUser?.avatarVersion, info.avatarUrl]);

  useEffect(() => {
    // Reset trạng thái lỗi khi URL ảnh thay đổi (ví dụ khi user đổi ảnh mới)
    if (displayAvatarUrl) setAvatarError(false);
  }, [displayAvatarUrl]);

  // Logic tạo chữ cái đại diện nếu không có ảnh (Ví dụ: "Hoàng Dũng" -> "HD")
  const getAvatarInitials = () => {
    const name = currentUser?.TenNhanVien || displayUserName;
    if (name) {
      const words = name.trim().split(" ");
      if (words.length > 1) {
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
      }
      return name[0].toUpperCase();
    }
    return "UN";
  };

  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);

  // Lấy danh sách các trang mà role này có quyền truy cập để làm dữ liệu gợi ý
  const searchablePages = (menuByRole[role] || [])
    .filter(item => !item.section)
    .map(item => ({ label: item.label, path: item.path, icon: item.icon }));

  // Xử lý lọc gợi ý khi người dùng gõ
  useEffect(() => {
    if (searchTerm.trim().length > 0) {
      const filtered = searchablePages.filter(p => 
        p.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [searchTerm, role]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onMenuClick} // Gán sự kiện click vào đây
          type="button"
          className="h-10 w-10 rounded-xl border flex items-center justify-center hover:bg-gray-50 transition-colors active:scale-95"
        >
          <Menu size={20} />
        </button>

        <div className="relative max-w-xl flex-1" ref={searchRef}>
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
            placeholder={displaySearchPlaceholder}
            value={searchTerm}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && onSearch) {
                onSearch(searchTerm);
              }
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                if (onSearch) {
                  onSearch(""); // Kích hoạt tìm kiếm với từ khóa rỗng để xóa kết quả
                }
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Xóa tìm kiếm"
            >
              &times;
            </button>
          )}

          {/* 🌟 DROPDOWN GỢI Ý TÌM KIẾM */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50 animate-fade-in">
              <div className="px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Chức năng gợi ý
              </div>
              {suggestions.map((item, idx) => {
                const Icon = item.icon || FileText;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      navigate(item.path);
                      setSearchTerm("");
                      setShowSuggestions(false);
                    }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors group"
                  >
                    <Icon size={16} className="text-gray-400 group-hover:text-blue-600" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">{item.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative h-10 w-10 rounded-xl border flex items-center justify-center">
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <button className="relative h-10 w-10 rounded-xl border flex items-center justify-center">
          <Mail size={18} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* 👤 KHU VỰC THÔNG TIN PROFILE CÓ THỂ CLICK */}
        <div 
          onClick={() => navigate("/profile")}
          className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-transparent hover:border-gray-100 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-all"
          title="Xem trang cá nhân"
        >
          {/* 🖼️ XỬ LÝ ẢNH CHUYÊN NGHIỆP: Nếu có URL và chưa bị lỗi thì hiện ảnh, ngược lại hiện Initials */}
          {displayAvatarUrl && !avatarError ? (
            <img
              src={displayAvatarUrl}
              alt="avatar"
              className="h-10 w-10 rounded-full object-cover border border-gray-200 shadow-sm"
              // 🛡️ Khi trình duyệt không load được ảnh (404, 500...), hàm này sẽ kích hoạt fallback
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm border border-indigo-700">
              {getAvatarInitials()}
            </div>
          )}
          <div className="leading-4 select-none">
            <p className="text-sm font-semibold text-gray-800">{displayUserName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{displayRoleName}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="h-10 w-10 rounded-xl border flex items-center justify-center text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          title="Đăng xuất"
          aria-label="Đăng xuất"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}