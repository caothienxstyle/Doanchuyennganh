const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const {
    getTonKho,
    getTonKhoById,
    createTonKho,
    updateTonKho,
    deleteTonKho,
    getDanhSachViTriKho
} = require("../controllers/tonKhoController");

router.get("/danhsach", authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), getDanhSachViTriKho);
router.get("/", authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), getTonKho);
router.get("/:maKho", authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), getTonKhoById);
router.post("/taotonkho", authenticate, authorize("Admin", "Quản lý kho"), createTonKho);
router.put("/capnhattonkho", authenticate, authorize("Admin", "Quản lý kho"), updateTonKho);
router.delete("/xoatonkho", authenticate, authorize("Admin", "Quản lý kho"), deleteTonKho);
module.exports = router;
