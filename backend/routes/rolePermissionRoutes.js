const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const authorize    = require("../middleware/roleMiddleware");
const ctrl         = require("../controllers/rolePermissionController");

// ==========================================
// ĐỊNH TUYẾN QUYỀN HẠN (PERMISSIONS)
// ==========================================
router.get("/permissions",          authenticate, authorize("Admin"), ctrl.getPermissions);
router.post("/permissions/taomoi",  authenticate, authorize("Admin"),                ctrl.createPermission);

// ==========================================
// ĐỊNH TUYẾN VAI TRÒ (ROLES)
// ==========================================
router.get("/roles/danhsach",       authenticate, authorize("Admin"), ctrl.getRoles);
router.post("/roles/taomoi",        authenticate, authorize("Admin"),                ctrl.createRole);
router.put("/roles/capnhat/:id",    authenticate, authorize("Admin"),                ctrl.updateRole);
router.delete("/roles/xoa/:id",     authenticate, authorize("Admin"),                ctrl.deleteRole);

module.exports = router;