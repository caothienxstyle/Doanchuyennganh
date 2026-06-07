const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const {
    getAllViTriKho,
    getViTriByMaKho,
    getViTriById,
    createViTriKho,
    createManyViTriKho,
    updateViTriKho,
    deleteViTriKho,
} = require("../controllers/VitrikhoController");

router.get("/danhsach",           authenticate, getAllViTriKho);
router.get("/theokho/:maKho",    authenticate, getViTriByMaKho);
router.get("/:id",                authenticate, getViTriById);
router.post("/taomoi",            authenticate, createViTriKho);
router.post("/taonhieu",          authenticate, createManyViTriKho);
router.put("/capnhat/:id",        authenticate, updateViTriKho);
router.delete("/xoa/:id",         authenticate, deleteViTriKho);

module.exports = router;