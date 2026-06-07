const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const authorize    = require("../middleware/roleMiddleware");
const { getAllKho, getKhoById, createKho, updateKho, deleteKho } = require("../controllers/KhoController");

router.get("/danhsach",     authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), getAllKho);
router.get("/:id",          authenticate, authorize("Admin", "Quản lý kho", "Nhân viên kho"), getKhoById);
router.post("/taomoi",      authenticate, authorize("Admin", "Quản lý kho"),                  createKho);
router.put("/capnhat/:id",  authenticate, authorize("Admin", "Quản lý kho"),                  updateKho);
router.delete("/xoa/:id",   authenticate, authorize("Admin", "Quản lý kho"),                  deleteKho);

module.exports = router;