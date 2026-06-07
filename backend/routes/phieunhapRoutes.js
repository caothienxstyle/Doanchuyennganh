const express = require("express");
const router = express.Router();
const { 
    createPhieuNhap, 
    approvePhieuNhap, 
    getAllPhieuNhap, 
    updatePhieuNhap, 
    getChiTietPhieuNhap
} = require("../controllers/phieunhapController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");


// 1. Xem danh sách phiếu nhập -> Cả 3 quyền đều được xem
router.get("/danhsach", authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), getAllPhieuNhap);

// 2. Tạo phiếu nhập (Trạng thái chờ duyệt) -> Cả 3 quyền đều được tạo
router.post("/taophieunhap", authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), createPhieuNhap);

// 3. Cập nhật phiếu nhập (Chỉ khi đang Chờ Duyệt) -> Cả 3 quyền đều được thực hiện
router.put("/capnhat", authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), updatePhieuNhap);

// 4. Duyệt phiếu nhập -> CHỈ Admin và Quản lý kho được làm
router.put("/duyetphieu", authenticate, authorize("Admin", "Quản lý kho"), approvePhieuNhap);

router.get("/chitiet/:id", authenticate, getChiTietPhieuNhap);

module.exports = router;