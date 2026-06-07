const express = require("express");
const router = express.Router();
const nccController = require("../controllers/nhaCungCapController");
// const { verifyToken } = require("../middleware/authMiddleware"); // Mở ra nếu bạn dùng JWT Auth để bảo mật

// Định nghĩa các cổng API kết nối Frontend
router.get("/danhsach", nccController.getAllNhaCungCap);                 // Lấy danh sách (GET)
router.get("/chitiet/:id", nccController.getDetailNhaCungCap);           // Xem chi tiết (GET)
router.post("/taomoi", nccController.createNhaCungCap);          // Tạo mới (POST)
router.put("/capnhat", nccController.updateNhaCungCap);          // Sửa đổi (PUT)
router.delete("/xoa/:id", nccController.deleteNhaCungCap);       // Xóa mềm (DELETE)

module.exports = router;