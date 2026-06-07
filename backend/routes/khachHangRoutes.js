const express = require('express');
const router = express.Router();
const khachHangController = require('../controllers/khachHangController');

// Khai báo các Endpoint kết nối tới Controller tương ứng
router.get('/danhsach', khachHangController.getAllKhachHang);          // Xem tất cả
router.get('/thongtin/:id', khachHangController.getKhachHangById);      // Xem chi tiết theo ID
router.post('/taokhachhang', khachHangController.createKhachHang);         // Thêm mới
router.put('/capnhatkhach/:id', khachHangController.updateKhachHang);       // Sửa đổi
router.delete('/xoa/:id', khachHangController.deleteKhachHang);    // Xóa mềm

module.exports = router;