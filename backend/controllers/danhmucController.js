const { sql, poolPromise } = require("../db/data");

// 🌟 ĐÃ SỬA: Lấy tất cả danh mục từ bảng DanhMuc
const getAllCategories = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT MaDanhMuc, TenDanhMuc, MaDanhMucCha, MoTa, IsDeleted 
            FROM DanhMuc 
            WHERE IsDeleted = 0 
            ORDER BY MaDanhMuc DESC
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;
        const result = await pool.request()
            .input("id", sql.Int, id)
            .query("SELECT * FROM DanhMuc WHERE MaDanhMuc = @id AND IsDeleted = 0");

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy danh mục yêu cầu." });
        }
        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createCategory = async (req, res) => {
    try {
        const { TenDanhMuc, MaDanhMucCha, MoTa } = req.body;
        if (!TenDanhMuc || !TenDanhMuc.trim()) {
            return res.status(400).json({ success: false, message: "Tên danh mục không được để trống." });
        }
        const pool = await poolPromise;
        await pool.request()
            .input("TenDanhMuc", sql.NVarChar, TenDanhMuc.trim())
            .input("MaDanhMucCha", sql.Int, MaDanhMucCha || null)
            .input("MoTa", sql.NVarChar, MoTa ? MoTa.trim() : null)
            .query(`
                INSERT INTO DanhMuc (TenDanhMuc, MaDanhMucCha, MoTa, IsDeleted, CreatedAt)
                VALUES (@TenDanhMuc, @MaDanhMucCha, @MoTa, 0, GETDATE())
            `);
        res.json({ success: true, message: "Thêm danh mục mới thành công!" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateCategory = async (req, res) => {
    try {
        const { MaDanhMuc, TenDanhMuc, MaDanhMucCha, MoTa } = req.body;
        if (!MaDanhMuc) {
            return res.status(400).json({ success: false, message: "Thiếu mã danh mục cần cập nhật." });
        }
        const pool = await poolPromise;
        const result = await pool.request()
            .input("MaDanhMuc", sql.Int, MaDanhMuc)
            .input("TenDanhMuc", sql.NVarChar, TenDanhMuc ? TenDanhMuc.trim() : null)
            .input("MaDanhMucCha", sql.Int, MaDanhMucCha || null)
            .input("MoTa", sql.NVarChar, MoTa ? MoTa.trim() : null)
            .query(`
                UPDATE DanhMuc 
                SET TenDanhMuc = ISNULL(@TenDanhMuc, TenDanhMuc), 
                    MaDanhMucCha = @MaDanhMucCha, 
                    MoTa = @MoTa
                WHERE MaDanhMuc = @MaDanhMuc AND IsDeleted = 0
            `);
        res.json({ success: true, message: "Cập nhật danh mục thành công!" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { MaDanhMuc } = req.body;

        if (!MaDanhMuc) {
            return res.status(400).json({ success: false, message: "Thiếu mã danh mục cần xóa." });
        }

        const pool = await poolPromise;

        // 🌟 BƯỚC 1: Kiểm tra xem danh mục này đã bị xóa mềm trước đó chưa
        const checkResult = await pool.request()
            .input("MaDanhMuc", sql.Int, MaDanhMuc)
            .query("SELECT IsDeleted FROM DanhMuc WHERE MaDanhMuc = @MaDanhMuc");

        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Danh mục không tồn tại." });
        }

        if (checkResult.recordset[0].IsDeleted === true) {
            return res.status(400).json({ success: false, message: "Danh mục này đã bị xóa trước đó rồi, không thể xóa tiếp!" });
        }

        // 🌟 BƯỚC 2: Thực hiện xóa mềm nếu danh mục vẫn chưa bị xóa
        const result = await pool.request()
            .input("MaDanhMuc", sql.Int, MaDanhMuc)
            .query("UPDATE DanhMuc SET IsDeleted = 1 WHERE MaDanhMuc = @MaDanhMuc");

        // Lưu Log Lịch Sử Thao Tác
        const userId = req.user?.id || req.user?.maNhanVien || 1;
        await pool.request()
            .input("MaNhanVien", sql.Int, userId)
            .input("HanhDong", sql.NVarChar, "DELETE")
            .input("BangTacDong", sql.NVarChar, "DanhMuc")
            .input("NoiDungMoi", sql.NVarChar, `Xóa mềm danh mục ID: ${MaDanhMuc}`)
            .query(`INSERT INTO LichSuThaoTac(MaNhanVien, HanhDong, BangTacDong, NoiDungMoi) VALUES(@MaNhanVien, @HanhDong, @BangTacDong, @NoiDungMoi)`);

        res.json({ success: true, message: "Xóa danh mục thành công!" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllCategories, // 🌟 Đã đồng bộ tên export
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
};