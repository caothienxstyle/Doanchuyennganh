const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const upload = require("../middleware/upload");

// 1. Import đầy đủ 5 hàm từ Controller sang
const {
    getProducts,
    getProductById, // Hàm lấy chi tiết sản phẩm theo ID vừa viết thêm
    createProduct,
    updateProduct,  // Hàm cập nhật sản phẩm vừa viết thêm
    deleteProduct,   // Hàm xóa mềm sản phẩm vừa viết thêm
    getLowStockProducts   
} = require("../controllers/spController");

// Thêm đường dẫn này vào TRƯỚC dòng router.get("/:id", ...) nhé!
router.get("/low-stock", authenticate, getLowStockProducts);

// Lấy toàn bộ danh sách sản phẩm
router.get(
    "/danhsachsanpham",
    authenticate,
    getProducts
);

// 2. Lấy CHI TIẾT 1 sản phẩm theo ID (Ví dụ: /products/3)
router.get(
    "/:id",
    authenticate,
    getProductById
);

// Tạo mới sản phẩm
router.post(
    "/taosanpham",
    authenticate,
    authorize("Admin", 
            "Quản lý kho", 
            "Nhân viên kho"),
      upload.single("AnhSanPham"),  // Middleware để xử lý file ảnh (nếu có)
    createProduct
);

// 3. Cập nhật sản phẩm (Gửi dữ liệu qua Body của request PUT)
router.put(
    "/capnhatsanpham",
    authenticate,
    authorize("Admin", "Quản lý kho", "Nhân viên kho"),
    upload.single("AnhSanPham"),  // Middleware để xử lý file ảnh (nếu có)
    updateProduct

);

// 4. Xóa mềm sản phẩm (Gửi MaSP qua Body của request DELETE)
router.delete(
    "/xoasanpham",
    authenticate,
    authorize("Admin", "Quản lý kho"),
    deleteProduct
);



module.exports = router;