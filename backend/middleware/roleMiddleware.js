const normalizeRole = (role) => {
    if (!role) return role;

    const aliases = {
        QuanLy: "Quản lý kho",
        "Nhân viên": "Nhân viên kho"
    };

    return aliases[role] || role;
};

const authorize = (...roles) => {
    return (req, res, next) => {
        // 1. Kiểm tra xem user đã qua bước authenticate (đăng nhập) chưa
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Chưa đăng nhập"
            });
        }

        // 2. Kiểm tra xem quyền của user (lấy từ Token) có nằm trong danh sách được phép không
        const userRole = normalizeRole(req.user.role);
        const allowedRoles = roles.map(normalizeRole);

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền truy cập chức năng này (Access denied)"
            });
        }

        next();
    };
};

module.exports = authorize;