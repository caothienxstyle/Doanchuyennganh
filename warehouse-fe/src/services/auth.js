export const ROLES = {
  staff: "NhanVien",
  manager: "QuanLy",
  admin: "Admin",
};

export const ROLE_HOME = {
  [ROLES.staff]: "/staff",
  [ROLES.manager]: "/manager",
  [ROLES.admin]: "/admin",
};

export const ROLE_LABELS = {
  [ROLES.staff]: "Nhân viên kho",
  [ROLES.manager]: "Quản lý kho",
  [ROLES.admin]: "Admin",
};

export const DEFAULT_ROLE_INFO = {
  roleName: "Nhân viên kho",
  brandSubtitle: "Bảng điều khiển nhân viên",
  userName: "Nhân viên",
  searchPlaceholder: "Tìm kiếm sản phẩm hoặc lô hàng",
  avatarUrl:
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect width='48' height='48' rx='24' fill='%23062b52'/><text x='24' y='31' text-anchor='middle' font-size='20' fill='white' font-family='Arial'>HD</text></svg>",
};

export const ROLE_INFO = {
  [ROLES.staff]: {
    ...DEFAULT_ROLE_INFO,
    roleName: ROLE_LABELS[ROLES.staff],
    brandSubtitle: "Bảng điều khiển nhân viên",
    userName: "Nhân viên",
    searchPlaceholder: "Tìm kiếm sản phẩm hoặc lô hàng",
  },
  [ROLES.manager]: {
    ...DEFAULT_ROLE_INFO,
    roleName: ROLE_LABELS[ROLES.manager],
    brandSubtitle: "Bảng điều khiển quản lý",
    userName: "Quản lý kho",
    searchPlaceholder: "Tìm kiếm đơn nhập, xuất và tồn kho",
  },
  [ROLES.admin]: {
    ...DEFAULT_ROLE_INFO,
    roleName: ROLE_LABELS[ROLES.admin],
    brandSubtitle: "Bảng điều khiển quản trị",
    userName: "Admin",
    searchPlaceholder: "Tìm kiếm người dùng, vai trò và nhật ký hệ thống",
  },
};

// =========================
// ROLE
// =========================

export function normalizeRole(role) {
  if (!role) {
    return null;
  }

  if (Object.values(ROLES).includes(role)) {
    return role;
  }

  const normalized = Object.entries(ROLE_LABELS).find(
    ([, label]) => label === role
  );

  return normalized?.[0] || null;
}

export function isValidRole(role) {
  return !!normalizeRole(role);
}

export function getHomeForRole(role) {
  const normalized = normalizeRole(role);
  return normalized ? ROLE_HOME[normalized] : "/login";
}

export function getRoleInfo(role) {
  const normalized = normalizeRole(role);

  if (!normalized) {
    return {
      ...DEFAULT_ROLE_INFO,
      roleName: role || DEFAULT_ROLE_INFO.roleName,
    };
  }

  return ROLE_INFO[normalized] || {
    ...DEFAULT_ROLE_INFO,
    roleName: ROLE_LABELS[normalized] || DEFAULT_ROLE_INFO.roleName,
  };
}

// =========================
// AUTH
// =========================

export function normalizeUserSession(user) {
  if (!user || typeof user !== "object") {
    return user;
  }

  const avatar = user.AnhDaiDien || user.anhDaiDien || user.avatar || user.image || "";

  return {
    ...user,
    role: user.role || user.TenVaiTro || user.tenVaiTro || "",
    AnhDaiDien: avatar,
    avatar,
    image: avatar,
  };
}

export function getCurrentRole() {
  try {
    const user = normalizeUserSession(JSON.parse(localStorage.getItem("user")));

    if (user && isValidRole(user.role)) {
      return normalizeRole(user.role);
    }

    return null;
  } catch {
    return null;
  }
}

export function getCurrentUser(fallbackRole = ROLES.staff) {
  try {
    const savedUser = normalizeUserSession(JSON.parse(localStorage.getItem("user")));

    if (savedUser) {
      const role = normalizeRole(savedUser.role) || fallbackRole;
      const roleInfo = getRoleInfo(role);

      return {
        ...roleInfo,
        ...savedUser,
      };
    }
  } catch (error) {
    console.log(error);
  }

  const role = normalizeRole(fallbackRole) || ROLES.staff;

  return {
    ...getRoleInfo(role),
    role,
  };
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// =========================
// TOKEN
// =========================

export function getToken() {
  return localStorage.getItem("token");
}

export function isAuthenticated() {
  return !!getToken();
}