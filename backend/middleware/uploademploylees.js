const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, "uploads/employees/");
    },
    filename(req, file, cb) {
        cb(
            null,
            Date.now() +
                "-" +
                Math.round(Math.random() * 1e9) +
                path.extname(file.originalname)
        );
    },
});

module.exports = multer({ storage });