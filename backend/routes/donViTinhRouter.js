const express = require("express");
const router = express.Router();
const donViTinhController = require("../controllers/donViTinhController"); // Đường dẫn tùy cấu trúc project

// Sửa đường dẫn thành /danhsachdonvitinh để trùng khít với cái FE của bạn đang gọi bị lỗi 500 nhé!
router.get("/danhsachdonvitinh", donViTinhController.getAllDonViTinh);
router.post("/them", donViTinhController.createDonViTinh);
router.put("/sua/:id", donViTinhController.updateDonViTinh);
router.delete("/xoa/:id", donViTinhController.deleteDonViTinh);

module.exports = router;