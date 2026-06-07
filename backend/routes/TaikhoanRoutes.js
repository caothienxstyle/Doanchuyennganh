const express = require("express");
const router  = express.Router();
const authenticate = require("../middleware/authMiddleware");
const authorize    = require("../middleware/roleMiddleware");
const {
    getAllTaiKhoan,
    getTaiKhoanById,
    createTaiKhoan,
    updateTaiKhoan,
    resetMatKhau,
    updateTrangThai,
    deleteTaiKhoan,
} = require("../controllers/TaikhoanController");


router.get("/danhsach",           authenticate, authorize("Admin"), getAllTaiKhoan);
router.get("/:id",                authenticate, authorize("Admin"), getTaiKhoanById);
router.post("/taomoi",            authenticate, authorize("Admin"), createTaiKhoan);
router.put("/capnhat/:id",        authenticate, authorize("Admin"), updateTaiKhoan);
router.patch("/doiMatKhau/:id",   authenticate, authorize("Admin"), resetMatKhau);
router.patch("/trangthai/:id",    authenticate, authorize("Admin"), updateTrangThai);
router.delete("/xoa/:id",         authenticate, authorize("Admin"), deleteTaiKhoan);

module.exports = router;