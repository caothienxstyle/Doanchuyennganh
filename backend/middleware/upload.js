const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Đường dẫn tuyệt đối tới thư mục uploads/products
const uploadDir = path.join(__dirname, "../uploads/products");

// Nếu chưa có thì tự tạo
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);

        const fileName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            ext;

        cb(null, fileName);
    },
});

const upload = multer({
    storage,
});

module.exports = upload;