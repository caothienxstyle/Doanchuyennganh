const express = require("express");
const router = express.Router();
const {
    getAllNhanVien,
    getNhanVienById,
    createNhanVien,
    updateNhanVien,
    deleteNhanVien
} = require("../controllers/nhanVienController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const upload = require("../middleware/uploademploylees");


// 1. Xem danh sách nhân viên -> Cả 3 quyền đều được xem
router.get("/danhsach", authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), getAllNhanVien);

// 2. Xem chi tiết một nhân viên -> Cả 3 quyền đều được xem
router.get("/chitiet/:id", authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), getNhanVienById);

// 3. Thêm mới nhân viên -> CHỈ Admin và Quản lý kho được thực hiện
router.post("/taonhanvien", authenticate, authorize("Admin", "Quản lý kho"), upload.single("AnhDaiDien"), createNhanVien);

// 4. Cập nhật thông tin nhân viên -> CHỈ Admin và Quản lý kho được thực hiện
router.put("/capnhat/:id", authenticate, authorize("Admin", "Quản lý kho"), upload.single("AnhDaiDien"), updateNhanVien);

// 5. Xóa mềm nhân viên -> CHỈ Admin mới có quyền tối cao này
router.delete("/xoanhanvien/:id", authenticate, authorize("Admin"), deleteNhanVien);

module.exports = router;