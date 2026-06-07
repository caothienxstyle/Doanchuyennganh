const express = require("express");
const router = express.Router();
const phieuxuatController = require("../controllers/phieuxuatController"); 

// Import đúng 2 middleware theo chuẩn dự án của bạn
const authenticate = require("../middleware/authMiddleware"); 
const authorize = require("../middleware/roleMiddleware"); 

// 1. Tạo phiếu xuất kho -> Dùng 'authenticate' trước, sau đó cho phép cả 3 quyền tạo
router.post(
    "/taophieuxuat", 
    authenticate, 
    authorize("Admin", "Quản lý kho", "Nhân viên kho"), 
    phieuxuatController.createPhieuXuat
);

router.put(
    "/capnhatphieuxuat", 
    authenticate, 
    authorize("Admin", "Quản lý kho", "Nhân viên kho"), 
    phieuxuatController.updatePhieuXuat
);

// 2. Duyệt phiếu xuất kho -> Chỉ Admin và Quản lý kho được duyệt (Giống y hệt bên duyệt phiếu nhập)
router.put(
    "/duyetphieuxuat", 
    authenticate, 
    authorize("Admin", "Quản lý kho"), 
    phieuxuatController.duyetPhieuXuat
);



// 3. Xem danh sách phiếu xuất
router.get(
    "/danhsach", 
    authenticate, 
    authorize("Admin", "Quản lý kho", "Nhân viên kho"), 
    phieuxuatController.getAllPhieuXuat
);

// 4. Xem chi tiết phiếu xuất
router.get(
    "/chitiet/:id", 
    authenticate, 
    authorize("Admin", "Quản lý kho", "Nhân viên kho"), 
    phieuxuatController.getPhieuXuatDetail
);

module.exports = router;