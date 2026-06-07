const express = require("express");
const router = express.Router();
const { getCardStats } = require("../controllers/dashboardController");

const authenticate = require("../middleware/authMiddleware"); 

router.get("/card-stats", authenticate, getCardStats);

module.exports = router;