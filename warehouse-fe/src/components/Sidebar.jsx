import { NavLink, Link } from "react-router-dom";
import { menuByRole } from "../constants/menu";
import { HelpCircle } from "lucide-react"; 
import { normalizeRole } from "../services/auth";

export default function Sidebar({ role = "NhanVien", isOpen = true }) {
  // 🌟 ROLE SYNC: Đồng bộ quyền từ hệ thống
  const currentRole = normalizeRole(role) || "NhanVien";
  const menu = menuByRole[currentRole] || menuByRole["NhanVien"];

  return (
    // 🎨 HẠ SÁNG TRIỆT ĐỂ: Nền tổng thể chuyển sang màu Xanh Biển Thẫm / Chàm đậm (bg-[#0a2540]) cực kỳ đầm và sang
    <aside className={`h-full bg-[#0a2540] text-slate-200 border-r border-white/[0.04] flex flex-col shrink-0 select-none shadow-2xl transition-all duration-300 ${isOpen ? "w-64 opacity-100" : "w-0 opacity-0 overflow-hidden border-none"}`}>
      
      {/* BRAND HEADER - Logo góc trên */}
      {/* 🎨 ĐÃ GIẢM SÁNG: Nền Header hạ xuống tông tối nhất của dải màu (bg-[#071b30]) */}
      <Link 
        to={currentRole === "Admin" ? "/admin" : currentRole === "QuanLy" ? "/manager" : "/staff"} 
        className="flex h-16 items-center gap-3 px-5 border-b border-white/[0.04] bg-[#071b30] shrink-0"
      >
        {/* Khối Logo HD sử dụng màu xanh đặc trưng của icon hình hộp ở trang login */}
        <div className="h-9 w-9 rounded-xl bg-[#2563eb] text-white flex items-center justify-center font-black text-lg shadow-lg shadow-blue-600/20">
          HD
        </div>
        <div>
          <h1 className="font-extrabold text-sm tracking-wide leading-tight text-white">Warehouse</h1>
          {/* Chữ phụ hạ tông xuống màu xanh lam dịu mắt (text-blue-400/70) */}
          <p className="text-[10px] text-blue-400/70 font-semibold uppercase tracking-wider">Management System</p>
        </div>
      </Link>

      {/* NAVIGATION LIST */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 bg-[#0a2540] custom-scrollbar">
        {menu.map((item, index) => {
          if (item.section) {
            return (
              <p
                key={`section-${index}-${item.section}`}
                // 🎨 ĐÃ GIẢM SÁNG: Tiêu đề nhóm chức năng được giấu bớt độ sáng (text-slate-500) để làm nổi bật các menu chính
                className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 bg-[#0a2540] z-10"
              >
                {item.section}
              </p>
            );
          }

          const Icon = item.icon || HelpCircle;

          return (
            <NavLink
              key={`nav-${index}-${item.path}`}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold tracking-wide transition-colors duration-150 ${
                  isActive 
                    // 🎨 ĐỒNG BỘ NÚT ĐĂNG NHẬP: Khi Active, nút chuyển sang màu Xanh Rực (bg-[#2563eb]) y hệt nút Login của bạn
                    ? "bg-[#2563eb] text-white shadow-lg shadow-blue-600/30 font-extrabold pointer-events-none" 
                    // Khi chưa active: Chữ màu xám xanh dịu (text-slate-400), khi hover chỉ sáng nhẹ lên (hover:bg-white/[0.05])
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                }`
              }
            >
              <Icon size={16} className="shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* FOOTER BADGE - Thông tin quyền hạn dưới đáy */}
      {/* 🎨 ĐÃ GIẢM SÁNG: Khối chân trang hạ về màu tối trùng với header (bg-[#071b30]) */}
      <div className="p-4 border-t border-white/[0.04] bg-[#071b30] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Role</span>
            <span className="text-xs font-black text-blue-400 mt-0.5">{currentRole}</span>
          </div>
          {/* Huy hiệu Live với độ sáng vừa phải, tinh tế */}
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wide">Live</span>
          </div>
        </div>
      </div>
    </aside>
  );
}