const express    = require("express");
const router     = express.Router();
const { taoTaiKhoan } = require("../controllers/adminController");
const {authenticate}    = require("../middleware/authMiddleware");
const authorize       = require("../middleware/roleMiddleware");

router.post(
    "/tao-tai-khoan",
    authenticate,
    authorize("Admin"),
    taoTaiKhoan
);

module.exports = router;