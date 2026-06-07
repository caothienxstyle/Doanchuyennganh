import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import StaffDashboard from "../pages/StaffDashboard";
import ManagerDashboard from "../pages/ManagerDashboard";
import AdminDashboard from "../pages/AdminDashboard";
import ProductPage from "../pages/ProductPage";
import InventoryPage from "../pages/InventoryPage";
import ImportPage from "../pages/ImportPage";
import ExportPage from "../pages/ExportPage";
import IncidentPage from "../pages/IncidentPage";
import ActivityLogPage from "../pages/LogPage";
import UserPage from "../pages/NhanvienPage";
import CategoryPage from "../pages/CategoryPage";
import PlaceholderPage from "../pages/PlaceholderPage";
import { getCurrentRole, getHomeForRole, ROLES } from "../services/auth";
import ProfilePage from "../pages/ProfilePage";
import ApprovePage from "../pages/ApprovePage";
import CustomerPage from "../pages/CustomerPage";
import ReportsPage from "../pages/ReportsPage";
import NhaCungCapPage from "../pages/NhaCungCapPage";
import KhoPage from "../pages/KhoPage";
import TaikhoanPage from "../pages/TaikhoanPage";
import BaoHanhPage from "../pages/BaoHanhPage";
import PhieubaohanhPage from "../pages/PhieubaohanhPage";
import RolePage from "../pages/RolePage";

function RequireAuth({ allowedRoles, children }) {
  const role = getCurrentRole();

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={getHomeForRole(role)} replace />;
  }

  return children;
}

function PublicLogin() {
  const role = getCurrentRole();
  return role ? <Navigate to={getHomeForRole(role)} replace /> : <LoginPage />;
}

function ProtectedPage({ allowedRoles, children }) {
  return <RequireAuth allowedRoles={allowedRoles}>{children}</RequireAuth>;
}

const staffAndManager = [ROLES.staff, ROLES.manager];
const managerOnly = [ROLES.manager];
const adminOnly = [ROLES.admin];
const managerAndAdmin = [ROLES.manager, ROLES.admin];
const allRoles = [ROLES.staff, ROLES.manager, ROLES.admin];

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<PublicLogin />} />

      <Route path="/staff" element={<ProtectedPage allowedRoles={[ROLES.staff]}><StaffDashboard /></ProtectedPage>} />
      <Route path="/manager" element={<ProtectedPage allowedRoles={managerOnly}><ManagerDashboard /></ProtectedPage>} />
      <Route path="/admin" element={<ProtectedPage allowedRoles={adminOnly}><AdminDashboard /></ProtectedPage>} />

      <Route path="/products" element={<ProtectedPage allowedRoles={allRoles}><ProductPage /></ProtectedPage>} />
      <Route path="/inventory" element={<ProtectedPage allowedRoles={staffAndManager}><InventoryPage /></ProtectedPage>} />
      <Route path="/imports" element={<ProtectedPage allowedRoles={staffAndManager}><ImportPage /></ProtectedPage>} />
      <Route path="/exports" element={<ProtectedPage allowedRoles={staffAndManager}><ExportPage /></ProtectedPage>} />
      <Route path="/incidents" element={<ProtectedPage allowedRoles={staffAndManager}><IncidentPage /></ProtectedPage>} />
      <Route path="/logs" element={<ProtectedPage allowedRoles={[ROLES.manager, ROLES.admin]}><ActivityLogPage /></ProtectedPage>} />
      <Route path="/users" element={<ProtectedPage allowedRoles={managerAndAdmin}><UserPage /></ProtectedPage>} />
      <Route path="/categories" element={<ProtectedPage allowedRoles={allRoles}><CategoryPage /></ProtectedPage>} />

        <Route
          path="/customers"
          element={<CustomerPage />}
        />
      <Route
        path="/Kho"
        element={<KhoPage />  }
      />
      <Route
        path="/search"
        element={
          <ProtectedPage allowedRoles={[ROLES.staff]}>
            <PlaceholderPage title="Tìm kiếm sản phẩm" description="Tra cứu nhanh sản phẩm, mã hàng và vị trí đang lưu trữ." />
          </ProtectedPage>
        }
      />
      <Route
        path="/baohanh"
        element={<BaoHanhPage />
        }
      />
      <Route
        path="/PhieuBaoHanh"
        element={<PhieubaohanhPage />  }
      />
      <Route
        path="/approvals"
        element={
          <ProtectedPage allowedRoles={managerOnly}>
            <ApprovePage /> 
          </ProtectedPage>
        }
      />
      <Route
        path="/reports"
        element={<ReportsPage/>}
      />
      <Route
        path="/NCC"
        element={<NhaCungCapPage/>
        }
      />
      <Route
        path="/roles"
        element={ <RolePage />
        }
      />
      <Route
        path="/backup"
        element={
          <ProtectedPage allowedRoles={adminOnly}>
            <PlaceholderPage title="Sao lưu dữ liệu" description="Theo dõi và thực hiện các tác vụ sao lưu, khôi phục dữ liệu." />
          </ProtectedPage>
        }
      />

        <Route
          path="/profile"
          element={<ProfilePage />}
        />

        <Route
          path="/tk"
          element={
            <ProtectedPage allowedRoles={adminOnly}>
              <TaikhoanPage />
            </ProtectedPage>
          }
        />


      <Route path="*" element={<RequireAuth><Navigate to={getHomeForRole(getCurrentRole())} replace /></RequireAuth>} />
    </Routes>
    
  );
}
