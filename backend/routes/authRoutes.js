// 1. SỬA ĐOẠN ĐẦU NÀY: Dùng Router chính chủ của Express thay vì thư viện ngoài
const express = require("express");
const router = express.Router(); 

// 2. Import các hàm từ Controller
const {
    login,
    getProfile,
    changePassword
} = require("../controllers/authController");

// 3. Import các Middleware xác thực (Dùng bốc tách Object chuẩn)
const { authenticate, authenticateToken } = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

// --- HỆ THỐNG ROUTE ---

// login
router.post("/login", login);

// đổi mật khẩu
router.post(
    "/DoiMatKhau",
    authenticate,
    changePassword
);

// admin
router.get(
    "/admin",
    authenticate,
    authorize("Admin"),
    (req, res) => {
        res.json({ success: true, message: "Welcome Admin" });
    }
);

// manager
router.get(
    "/manager",
    authenticate,
    authorize("Quản lý kho"),
    (req, res) => {
        res.json({ success: true, message: "Welcome Manager" });
    }
);

// staff
router.get(
    "/staff",
    authenticate,
    authorize("Nhân viên kho"),
    (req, res) => {
        res.json({ success: true, message: "Welcome Staff" });
    }
);

// thông tin cá nhân me
router.get(
    "/me",
    authenticateToken,
    getProfile
);

module.exports = router;

