const express = require("express");
const router  = express.Router();
const authenticate = require("../middleware/authMiddleware");
const authorize    = require("../middleware/roleMiddleware");
const {
    getAllBaoHanh,
    getBaoHanhById,
    createBaoHanh,
    updateBaoHanh,
    updateTrangThai,
    deleteBaoHanh,
    checkBaoHanh
} = require("../controllers/Baohanhcontroller");


router.get("/danhsach",         authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), getAllBaoHanh);
router.get("/kiemtra",          authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), checkBaoHanh);
router.get("/chitiet/:id",      authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), getBaoHanhById);
router.post("/taomoi",          authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), createBaoHanh);
router.put("/capnhat/:id",      authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), updateBaoHanh);
router.patch("/trangthai/:id",  authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), updateTrangThai);
router.delete("/xoa/:id",       authenticate, authorize("Admin", "Quản lý kho"),                  deleteBaoHanh);

module.exports = router;