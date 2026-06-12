const jwt = require("jsonwebtoken");
const { sql, poolPromise } = require("../db/data");

/**
 * Logic xác thực chung cho cả authenticate và authenticateToken
 */
const verifyUserStatus = async (req, res, next, errorCode = 401) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(errorCode).json({
                success: false,
                message: "Không tìm thấy mã xác thực (Token)!"
            });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const pool = await poolPromise;
        const result = await pool.request()
            .input("maNhanVien", sql.Int, decoded.id)
            .query(`
                SELECT tk.TrangThai, vt.TenVaiTro, nv.IsDeleted, nv.TrangThai AS TrangThaiNV,
                (
                    SELECT qh.MaQuyen, qh.TenQuyen
                    FROM VaiTro_QuyenHan vtqh
                    JOIN QuyenHan qh ON vtqh.MaQuyen = qh.MaQuyen
                    WHERE vtqh.MaVaiTro = tk.MaVaiTro
                    FOR JSON PATH
                ) AS QuyenHan
                FROM TaiKhoan tk
                INNER JOIN VaiTro vt ON tk.MaVaiTro = vt.MaVaiTro
                INNER JOIN NhanVien nv ON tk.MaNhanVien = nv.MaNhanVien
                WHERE tk.MaNhanVien = @maNhanVien
            `);

        if (result.recordset.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Tài khoản không tồn tại trên hệ thống!"
            });
        }

        const dbUser = result.recordset[0];

        // 1. Kiểm tra trạng thái nghỉ việc/xóa của nhân viên
        if (dbUser.IsDeleted || dbUser.TrangThaiNV === 0 || dbUser.TrangThaiNV === false) {
            return res.status(403).json({
                success: false,
                message: "Tài khoản không thể sử dụng do nhân viên đã nghỉ việc hoặc bị xóa!"
            });
        }

        // 2. Kiểm tra trạng thái khóa của tài khoản
        if (dbUser.TrangThai === 0 || dbUser.TrangThai === false || dbUser.TrangThai === null) {
            return res.status(403).json({
                success: false,
                message: "Tài khoản của bạn hiện đang bị khóa!"
            });
        }

        // 3. Đồng bộ vai trò thời gian thực từ DB vào đối tượng req.user
        decoded.role = dbUser.TenVaiTro.trim();
        decoded.quyenHan = dbUser.QuyenHan ? JSON.parse(dbUser.QuyenHan) : [];
        req.user = decoded;

        next();
    } catch (error) {
        return res.status(errorCode).json({
            success: false,
            message: "Mã xác thực không hợp lệ hoặc đã hết hạn!"
        });
    }
};

// 1. Hàm authenticate (Dùng cho các route chung)
const authenticate = (req, res, next) => verifyUserStatus(req, res, next, 401);

// 2. Hàm authenticateToken
const authenticateToken = (req, res, next) => verifyUserStatus(req, res, next, 403);

// Xuất module
authenticate.authenticate = authenticate;
authenticate.authenticateToken = authenticateToken;
module.exports = authenticate;