import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import { uploadAvatar } from "../services/profileService";
import { normalizeUserSession, getCurrentRole } from "../services/auth";

const SERVER_URL = "http://localhost:3000";

function getAvatarUrl(path, cacheKey = Date.now()) {
  if (!path) return "";

  const normalizedPath = String(path);

  if (/^data:/i.test(normalizedPath)) {
    return normalizedPath;
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return `${normalizedPath}${normalizedPath.includes("?") ? "&" : "?"}v=${cacheKey}`;
  }

  const baseUrl = `${SERVER_URL}${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`;
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}v=${cacheKey}`;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  // State cho tính năng đổi mật khẩu
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [cropPosition, setCropPosition] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(1);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // 1. Lấy dữ liệu tạm từ localStorage để hiển thị ngay lập tức (tránh UI bị trễ)
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(normalizeUserSession(JSON.parse(savedUser)));
      } catch (e) {
        console.error("Dữ liệu lưu trữ local không hợp lệ:", e);
      }
    }

    // 2. Đồng thời fetch dữ liệu mới nhất từ Server
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
      if (!token) throw new Error("Không tìm thấy phiên đăng nhập");

      const response = await fetch("http://localhost:3000/auth/me", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error("Phiên đăng nhập đã hết hạn hoặc không hợp lệ");

      const data = await response.json();
      
      // Đồng bộ theo cấu trúc: data.success và data.user từ BE trả về
      if (data.success && data.user) {
        // 🛡️ BỔ SUNG QUAN TRỌNG: Ánh xạ TenVaiTro sang role để không bị đá ra Login
        const updatedUser = normalizeUserSession({
          ...data.user,
          role: data.user.role || data.user.TenVaiTro,
        });
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      } else {
        throw new Error("Dữ liệu cấu trúc không hợp lệ");
      }
    } catch (err) {
      console.error("Lỗi fetchProfile:", err);
      if (!localStorage.getItem("user")) {
        setError("Không thể kết nối máy chủ. Vui lòng đăng nhập lại.");
      }
    }
  }

  function handleLogout() {
    localStorage.clear(); // Xóa sạch token khi đăng xuất
    navigate("/login");
  }

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      setCropPosition({ x: 50, y: 50 });
      setZoom(1);
    }
  };

  function createCroppedAvatarFile(file, position, scale) {
    return new Promise((resolve, reject) => {
      const imageUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const size = 1024;
          canvas.width = size;
          canvas.height = size;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(imageUrl);
            reject(new Error("Không tạo được canvas xử lý ảnh."));
            return;
          }

          const cropSize = Math.min(image.naturalWidth, image.naturalHeight) / scale;
          const sourceX = (image.naturalWidth - cropSize) * (position.x / 100);
          const sourceY = (image.naturalHeight - cropSize) * (position.y / 100);

          ctx.clearRect(0, 0, size, size);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, size, size);

          canvas.toBlob((blob) => {
            URL.revokeObjectURL(imageUrl);
            if (!blob) {
              reject(new Error("Không tạo được ảnh đã cắt."));
              return;
            }

            const croppedFile = new File([blob], file.name || "avatar.png", {
              type: blob.type || "image/jpeg",
              lastModified: Date.now(),
            });

            resolve(croppedFile);
          }, file.type || "image/jpeg", 0.92);
        } catch (error) {
          URL.revokeObjectURL(imageUrl);
          reject(error);
        }
      };

      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error("Không đọc được ảnh đã chọn."));
      };

      image.src = imageUrl;
    });
  }

  async function handleUploadAvatar() {
    if (!selectedImageFile) {
      alert("Vui lòng chọn ảnh trước khi tải lên.");
      return;
    }

    try {
      setIsUploading(true);
      const croppedFile = await createCroppedAvatarFile(selectedImageFile, cropPosition, zoom);
      const res = await uploadAvatar(croppedFile);
      if (res?.success) {
        const newAvatarPath = res.imageUrl || res.data?.AnhDaiDien || res.data?.avatar || user?.AnhDaiDien || user?.avatar || user?.image || "";
        const updatedUser = {
          ...user,
          AnhDaiDien: newAvatarPath || user?.AnhDaiDien || user?.avatar || user?.image || "",
          avatarVersion: Date.now(),
        };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        window.dispatchEvent(new CustomEvent("user-updated", { detail: updatedUser }));
        setSelectedImageFile(null);
        alert("Cập nhật ảnh đại diện thành công!");
      } else {
        alert(res?.message || "Không thể cập nhật ảnh đại diện.");
      }
    } catch (err) {
      console.error(err);
      alert("Upload ảnh thất bại. Vui lòng thử lại.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError("");

    // Validate phía FE
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return setPasswordError("Mật khẩu xác nhận không khớp!");
    }
    if (passwordData.newPassword.length < 8) {
      return setPasswordError("Mật khẩu mới phải có ít nhất 8 ký tự.");
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
      
      const response = await fetch("http://localhost:3000/auth/DoiMatKhau", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          // 🌟 ĐÃ CẬP NHẬT: Khớp với key 'password' và 'passwordnew' của Backend mới
          password: passwordData.oldPassword,
          passwordnew: passwordData.newPassword
        })
      });

      const data = await response.json();
      if (data.success) {
        alert("Thay đổi mật khẩu thành công!");
        setIsPasswordModalOpen(false);
        setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
        setShowOldPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
      } else {
        setPasswordError(data.message || "Có lỗi xảy ra khi đổi mật khẩu.");
      }
    } catch (err) {
      setPasswordError("Lỗi kết nối máy chủ. Vui lòng thử lại sau.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <div className="text-red-500 font-medium bg-red-50 px-4 py-2 rounded-lg border border-red-100 text-xs">
            ⚠️ {error}
          </div>
          <button onClick={handleLogout} className="text-blue-600 hover:underline text-xs font-bold">
            Quay lại đăng nhập
          </button>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh] text-xs text-gray-500 animate-pulse">
          Đang tải thông tin tài khoản cá nhân...
        </div>
      </MainLayout>
    );
  }

  // 🛠️ ĐỒNG BỘ HOÀN TOÀN CÁC KEY TỪ TRUY VẤN SQL CỦA BE TRẢ VỀ
  const maTaiKhoan = user.MaTaiKhoan || "";
  const tenDangNhap = user.TenDangNhap || "";
  const maNhanVien = user.MaNhanVien || "";
  const tenNhanVien = user.TenNhanVien || "";
  const email = user.Email || "";
  const sdt = user.SDT || ""; // Đã sửa từ SoDienThoai -> SDT theo SQL của bạn
  const cccd = user.CCCD || "";
  const diaChi = user.DiaChi || "";
  const tenVaiTro = user.TenVaiTro || "Nhân viên";
  const anhDaiDien = user.AnhDaiDien || user.image || user.avatar || "";

  // FIX LỖI CHECK TRẠNG THÁI: BE trả về trường 'TrangThaiTaiKhoan'
  // Giá trị true / 1 là đang hoạt động
  const isActive = user.TrangThaiTaiKhoan === true || Number(user.TrangThaiTaiKhoan) === 1;

  // Render chữ cái đại diện Avatar (Ví dụ: Nguyễn Thắng -> NT) nếu không có ảnh
  const getAvatarInitials = () => {
    if (tenNhanVien) {
      const words = tenNhanVien.trim().split(" ");
      if (words.length > 1) {
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
      }
      return tenNhanVien[0].toUpperCase();
    }
    return tenDangNhap ? tenDangNhap[0].toUpperCase() : "UN";
  };

  return (
    <MainLayout role={getCurrentRole()}>
      {/* Tiêu đề trang */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Trang cá nhân</h2>
        <p className="text-sm text-gray-400 mt-1">Thông tin chi tiết của thành viên đang đăng nhập hệ thống</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* CỘT TRÁI: HIỂN THỊ AVATAR & TRẠNG THÁI TÀI KHOẢN */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <div className="relative mx-auto mb-3 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-400 via-rose-400 to-orange-300 text-3xl font-bold text-white shadow-xl ring-4 ring-white group">
            {selectedImageFile ? (
              <div className="absolute inset-0 rounded-full border border-white/40 shadow-[inset_0_0_0_3px_rgba(255,255,255,0.35)]" />
            ) : null}
            {selectedImageFile ? (
              <img
                src={URL.createObjectURL(selectedImageFile)}
                alt="preview avatar"
                className="h-full w-full cursor-zoom-in object-cover bg-white/10"
                style={{
                  objectPosition: `${cropPosition.x}% ${cropPosition.y}%`,
                  transform: `scale(${zoom})`,
                  transformOrigin: `${cropPosition.x}% ${cropPosition.y}%`
                }}
                onClick={() => setZoomedImage(URL.createObjectURL(selectedImageFile))}
              />
            ) : anhDaiDien ? (
              <img
                src={getAvatarUrl(anhDaiDien, user?.avatarVersion || Date.now())}
                alt="avatar"
                className="h-full w-full cursor-zoom-in object-cover bg-white/10"
                onClick={() => setZoomedImage(getAvatarUrl(anhDaiDien, user?.avatarVersion || Date.now()))}
                onError={(e) => { e.target.src = "https://i.pravatar.cc/150?img=68"; }}
              />
            ) : (
              <span className="cursor-default">{getAvatarInitials()}</span>
            )}

            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-bold">Chọn ảnh
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          </div>

          <h3 className="text-base font-bold text-gray-800">{tenNhanVien || "Chưa cập nhật tên"}</h3>

          {selectedImageFile && (
            <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-left text-[11px] text-gray-600 shadow-sm">
              <p className="mb-2 text-[10px] text-gray-400">Kéo để căn khung và zoom để ảnh vừa khung tròn hơn.</p>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Căn ngang</label>
              <input
                type="range"
                min="0"
                max="100"
                value={cropPosition.x}
                onChange={(e) => setCropPosition((prev) => ({ ...prev, x: Number(e.target.value) }))}
                className="w-full accent-blue-600"
              />
              <label className="mb-1 mt-2 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Căn dọc</label>
              <input
                type="range"
                min="0"
                max="100"
                value={cropPosition.y}
                onChange={(e) => setCropPosition((prev) => ({ ...prev, y: Number(e.target.value) }))}
                className="w-full accent-blue-600"
              />
              <label className="mb-1 mt-2 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Zoom</label>
              <input
                type="range"
                min="1"
                max="2"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-pink-500"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCropPosition({ x: 50, y: 50 })}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-100"
                >
                  Đặt giữa
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-100"
                >
                  Zoom mặc định
                </button>
              </div>
            </div>
          )}

          {selectedImageFile && (
            <button
              onClick={handleUploadAvatar}
              disabled={isUploading}
              className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50"
            >
              {isUploading ? "Đang tải lên..." : "Tải ảnh đại diện"}
            </button>
          )}
          
          <p className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md inline-block mt-2 border border-blue-100 uppercase tracking-wider">
            {tenVaiTro}
          </p>

          <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between text-xs">
            <span className="text-gray-400 font-semibold">Trạng thái tài khoản:</span>
            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${
              isActive 
                ? "bg-green-50 text-green-700 border-green-200" 
                : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {isActive ? "Đang hoạt động" : "Đã bị khóa"}
            </span>
          </div>
        </div>

        {/* CỘT PHẢI: CHI TIẾT CÁC THÔNG TIN BIỂU MẪU */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          
          {/* KHỐI TÀI KHOẢN HỆ THỐNG */}
          <div>
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
              🛡️ Tài khoản xác thực
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50/60 p-3 rounded-xl border border-gray-100">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Mã ID Tài khoản</span>
                <span className="font-mono font-bold text-gray-700 text-sm block mt-0.5">
                  {maTaiKhoan ? `#ACC-${maTaiKhoan}` : "N/A"}
                </span>
              </div>
              <div className="bg-gray-50/60 p-3 rounded-xl border border-gray-100">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Tên đăng nhập hệ thống</span>
                <span className="font-mono font-bold text-gray-800 text-sm block mt-0.5">
                  {tenDangNhap || "Chưa cập nhật"}
                </span>
              </div>
            </div>
          </div>

          {/* KHỐI THÔNG TIN NHÂN SỰ CHI TIẾT */}
          <div>
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
              👤 Thông tin nhân sự chi tiết
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50/60 p-3 rounded-xl border border-gray-100">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Mã số nhân viên (MANHANVIEN)</span>
                <span className="font-mono font-bold text-indigo-600 text-sm block mt-0.5">
                  {maNhanVien ? `#NV-${maNhanVien}` : "N/A (Chưa gán mã)"}
                </span>
              </div>
              <div className="bg-gray-50/60 p-3 rounded-xl border border-gray-100">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Họ và tên đầy đủ</span>
                <span className="font-bold text-gray-800 text-sm block mt-0.5">
                  {tenNhanVien || "Chưa cập nhật họ tên"}
                </span>
              </div>
              <div className="bg-gray-50/60 p-3 rounded-xl border border-gray-100">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Hộp thư điện tử (Email)</span>
                <span className="font-medium text-gray-700 text-sm block mt-0.5">
                  {email || "Chưa đăng ký Email"}
                </span>
              </div>
              <div className="bg-gray-50/60 p-3 rounded-xl border border-gray-100">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Số điện thoại liên hệ</span>
                <span className="font-mono font-semibold text-gray-700 text-sm block mt-0.5">
                  {sdt || "Chưa đăng ký SĐT"}
                </span>
              </div>
              <div className="bg-gray-50/60 p-3 rounded-xl border border-gray-100 sm:col-span-2">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Số Căn cước công dân (CCCD)</span>
                <span className="font-mono font-semibold text-gray-800 text-sm block mt-0.5">
                  {cccd || "Chưa cập nhật số CCCD"}
                </span>
              </div>
              <div className="bg-gray-50/60 p-3 rounded-xl border border-gray-100 sm:col-span-2">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Địa chỉ hiện tại</span>
                <span className="font-medium text-gray-800 text-sm block mt-0.5">
                  {diaChi || "Chưa cập nhật địa chỉ"}
                </span>
              </div>
            </div>
          </div>

          {/* KHỐI PHÂN QUYỀN HỆ THỐNG ĐƯỢC CẤP TỪ BE */}
          {user.QuyenHan && user.QuyenHan.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                🗝️ Danh sách quyền hạn tài khoản
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {user.QuyenHan.map((q, index) => (
                  <span 
                    key={q.MaQuyen || index} 
                    title={q.MoTa}
                    className="bg-gray-100 text-gray-700 border border-gray-200 font-mono text-[10px] px-2 py-0.5 rounded-sm"
                  >
                    {q.TenQuyen}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* KHỐI NÚT CHỨC NĂNG */}
          <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2.5 justify-end text-xs">
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              type="button"
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-bold transition-all shadow-2xs"
            >
              🔒 Thay đổi mật khẩu
            </button>
            <button
              onClick={handleLogout}
              type="button"
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold transition-all"
            >
              🚪 Đăng xuất khỏi hệ thống
            </button>
          </div>

        </div>

      </div>

      {/* MODAL THAY ĐỔI MẬT KHẨU */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm">🔒 Thay đổi mật khẩu</h3>
              <button 
                onClick={() => { 
                  setIsPasswordModalOpen(false); 
                  setPasswordError("");
                  setShowOldPassword(false);
                  setShowNewPassword(false);
                  setShowConfirmPassword(false);
                }} 
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >&times;</button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              {passwordError && (
                <div className="text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 font-medium">
                  ⚠️ {passwordError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Mật khẩu hiện tại</label>
                <div className="relative">
                  <input
                    type={showOldPassword ? "text" : "password"}
                    required
                    className="w-full p-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    value={passwordData.oldPassword}
                    onChange={(e) => setPasswordData({...passwordData, oldPassword: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Mật khẩu mới (ít nhất 8 ký tự)</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    className="w-full p-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Xác nhận mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    className="w-full p-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setShowOldPassword(false);
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                  }}
                  className="px-4 py-2 text-xs font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200"
                >Hủy</button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:bg-gray-400 shadow-md transition-all"
                >{isSubmitting ? "Đang xử lý..." : "Cập nhật mật khẩu"}</button>
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
          <div className="relative max-w-3xl max-h-[85vh] rounded-3xl bg-white/10 p-3 shadow-2xl">
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute -top-11 right-0 text-sm font-bold text-white hover:text-gray-200"
            >✕ Đóng</button>
            <img
              src={zoomedImage}
              alt="Large view"
              className="max-h-[80vh] w-full max-w-2xl rounded-2xl border border-white/10 object-contain bg-white shadow-2xl"
            />
          </div>
        </div>
      )}
    </MainLayout>
  );
}