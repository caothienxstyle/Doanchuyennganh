const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
    getAllCategories,
    getCategoryById,
    createCategory, 
    updateCategory,
    deleteCategory
} = require("../controllers/danhmucController");

// 1. Lấy toàn bộ danh sách danh mục (Cả FE quản lý và FE dùng làm Select sản phẩm đều gọi chung cái này)
router.get("/danhsach", authenticate, getAllCategories);

// 2. Lấy chi tiết 1 danh mục theo ID
router.get("/:id", authenticate, getCategoryById);

// 3. Thêm mới danh mục
router.post("/themdanhmuc", authenticate, authorize("Admin", "Quản lý kho", "Nhân Viên Kho"), createCategory);

// 4. Cập nhật thông tin danh mục
router.put("/capnhat", authenticate, authorize("Admin", "Quản lý kho", "Nhân Viên Kho"), updateCategory);

// 5. Xóa mềm danh mục
router.delete("/xoa", authenticate, authorize("Admin", "Quản lý kho", "Nhân Viên Kho"), deleteCategory);

module.exports = router;