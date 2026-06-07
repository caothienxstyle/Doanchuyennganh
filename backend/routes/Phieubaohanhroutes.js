// Standardized detail route to use /chitiet/:id
const express = require("express");
const router  = express.Router();
const authenticate = require("../middleware/authMiddleware");
const authorize    = require("../middleware/roleMiddleware");
const {
    getAllPhieuBaoHanh,
    getPhieuBaoHanhById,
    createPhieuBaoHanh,
    updatePhieuBaoHanh,
    themSanPhamVaoPhieu,
    deletePhieuBaoHanh,
} = require("../controllers/Phieubaohanhcontroller"); // Match filename casing


router.get("/danhsach",              authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), getAllPhieuBaoHanh);
router.get("/chitiet/:id",           authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), getPhieuBaoHanhById);
router.post("/taomoi",               authenticate, authorize("Admin", "Quản lý kho"), createPhieuBaoHanh);
router.put("/capnhat/:id",           authenticate, authorize("Admin", "Quản lý kho"), updatePhieuBaoHanh);
router.post("/themsanpham/:id",      authenticate, authorize("Admin", "Quản lý kho"), themSanPhamVaoPhieu);
router.delete("/xoa/:id",            authenticate, authorize("Admin", "Quản lý kho"),                  deletePhieuBaoHanh);

module.exports = router;