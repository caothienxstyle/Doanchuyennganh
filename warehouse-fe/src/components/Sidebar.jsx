import { NavLink, Link } from "react-router-dom";
import { menuByRole } from "../constants/menu";
import { getRoleInfo } from "../services/auth";

export default function Sidebar({ role = "NhanVien", isVisible = true }) {
  const menu = menuByRole[role] || [];
  const info = getRoleInfo(role);

  // Lưu ý: Không nên return null ở đây nếu bạn muốn giữ hiệu ứng trượt từ MainLayout

  return (
    <aside className={`fixed left-0 top-0 h-screen w-64 bg-[#062b52] text-white transition-all duration-300 z-30 ${isVisible ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"}`}>
      <Link 
        to="/" 
        className="flex h-16 items-center gap-2 px-5 border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="h-10 w-10 rounded-xl bg-white text-[#062b52] flex items-center justify-center font-bold text-xl">
          HD
        </div>

        <div>
          <h1 className="font-bold leading-5">Warehouse</h1>
          <p className="text-xs text-blue-100">{info.brandSubtitle}</p>
        </div>
      </Link>

      <nav className="h-[calc(100vh-10rem)] overflow-y-auto p-3 space-y-1">
        {menu.map((item) => {
          if (item.section) {
            return (
              <p
                key={item.section}
                className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-blue-200/80"
              >
                {item.section}
              </p>
            );
          }

          const Icon = item.icon;

          return (
            <NavLink
              key={`${item.path}-${item.label}`}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive ? "bg-blue-600 text-white" : "text-blue-100 hover:bg-white/10"
                }`
              }
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="absolute bottom-4 left-3 right-3 rounded-2xl bg-white/10 p-4">
        <p className="text-sm font-semibold">Thông tin hệ thống</p>
        <p className="text-xs text-blue-100 mt-1">Phiên bản: 1.0.0</p>
        <p className="text-xs text-green-300">Online</p>
      </div>
    </aside>
  );
}
