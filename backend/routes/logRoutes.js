const express = require("express");
const router  = express.Router();
const { getDanhSachLog, getChiTietLog, getThongKeLog } = require("../controllers/logController");
const authenticate = require("../middleware/authMiddleware");
const authorize    = require("../middleware/roleMiddleware");

// Chỉ Admin mới xem được log
router.get("/",           authenticate, authorize("Admin", "Quản lý kho"), getDanhSachLog);
router.get("/thong-ke",   authenticate, authorize("Admin", "Quản lý kho"), getThongKeLog);
router.get("/:id",        authenticate, authorize("Admin", "Quản lý kho"), getChiTietLog);

module.exports = router;