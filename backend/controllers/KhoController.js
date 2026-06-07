const sql = require("mssql");
const { poolPromise } = require("../db/data");
const { writeLog } = require("./logController");

// GET /kho/danhsach
const getAllKho = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT MaKho, TenKho, DiaChi, MoTa, CreatedAt
            FROM Kho
            WHERE IsDeleted = 0
            ORDER BY MaKho ASC
        `);
        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error("Lỗi lấy danh sách kho:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /kho/:id
const getKhoById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;
        const result = await pool.request()
            .input("MaKho", sql.Int, parseInt(id))
            .query(`
                SELECT MaKho, TenKho, DiaChi, MoTa, CreatedAt
                FROM Kho
                WHERE MaKho = @MaKho AND IsDeleted = 0
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy kho!" });
        }
        return res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        console.error("Lỗi lấy thông tin kho:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /kho/taomoi
const createKho = async (req, res) => {
    try {
        const { TenKho, DiaChi, MoTa } = req.body;
        const MaNhanVien = req.user.id;

        if (!TenKho || !TenKho.trim()) {
            return res.status(400).json({ success: false, message: "Tên kho không được để trống!" });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input("TenKho", sql.NVarChar, TenKho.trim())
            .input("DiaChi", sql.NVarChar, DiaChi?.trim() || null)
            .input("MoTa",   sql.NVarChar, MoTa?.trim()   || null)
            .query(`
                INSERT INTO Kho (TenKho, DiaChi, MoTa)
                OUTPUT INSERTED.MaKho, INSERTED.TenKho, INSERTED.DiaChi, INSERTED.MoTa, INSERTED.CreatedAt
                VALUES (@TenKho, @DiaChi, @MoTa)
            `);

        const newKho = result.recordset[0];

        try {
            await writeLog(MaNhanVien, "Thêm mới", "Kho", `Tạo kho mới: ${TenKho.trim()} (MaKho: ${newKho.MaKho})`);
        } catch (logError) {
            console.error("⚠️ Lỗi ghi log:", logError.message);
        }

        return res.status(201).json({ success: true, message: "Tạo kho mới thành công!", data: newKho });
    } catch (error) {
        console.error("Lỗi tạo kho:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /kho/capnhat/:id
const updateKho = async (req, res) => {
    try {
        const { id } = req.params;
        const { TenKho, DiaChi, MoTa } = req.body;
        const MaNhanVien = req.user.id;

        if (!TenKho || !TenKho.trim()) {
            return res.status(400).json({ success: false, message: "Tên kho không được để trống!" });
        }

        const pool = await poolPromise;

        const check = await pool.request()
            .input("MaKho", sql.Int, parseInt(id))
            .query("SELECT MaKho, TenKho FROM Kho WHERE MaKho = @MaKho AND IsDeleted = 0");

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy kho cần cập nhật!" });
        }

        const tenCu = check.recordset[0].TenKho;

        await pool.request()
            .input("MaKho",  sql.Int,      parseInt(id))
            .input("TenKho", sql.NVarChar, TenKho.trim())
            .input("DiaChi", sql.NVarChar, DiaChi?.trim() || null)
            .input("MoTa",   sql.NVarChar, MoTa?.trim()   || null)
            .query(`
                UPDATE Kho
                SET TenKho = @TenKho, DiaChi = @DiaChi, MoTa = @MoTa
                WHERE MaKho = @MaKho
            `);

        try {
            await writeLog(MaNhanVien, "Cập nhật", "Kho", `Cập nhật kho ID ${id}: "${tenCu}" → "${TenKho.trim()}"`);
        } catch (logError) {
            console.error("⚠️ Lỗi ghi log:", logError.message);
        }

        return res.json({ success: true, message: "Cập nhật thông tin kho thành công!" });
    } catch (error) {
        console.error("Lỗi cập nhật kho:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /kho/xoa/:id
const deleteKho = async (req, res) => {
    try {
        const { id } = req.params;
        const MaNhanVien = req.user.id;
        const pool = await poolPromise;

        const checkViTri = await pool.request()
            .input("MaKho", sql.Int, parseInt(id))
            .query("SELECT COUNT(*) AS SoViTri FROM ViTriKho WHERE MaKho = @MaKho");

        if (checkViTri.recordset[0].SoViTri > 0) {
            return res.status(400).json({
                success: false,
                message: "Không thể xóa kho vì còn vị trí kho con! Hãy xóa hết vị trí trước."
            });
        }

        const check = await pool.request()
            .input("MaKho", sql.Int, parseInt(id))
            .query("SELECT TenKho FROM Kho WHERE MaKho = @MaKho AND IsDeleted = 0");

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy kho!" });
        }

        const tenKho = check.recordset[0].TenKho;

        await pool.request()
            .input("MaKho", sql.Int, parseInt(id))
            .query("UPDATE Kho SET IsDeleted = 1 WHERE MaKho = @MaKho");

        try {
            await writeLog(MaNhanVien, "Xóa", "Kho", `Xóa kho ID ${id}: "${tenKho}"`);
        } catch (logError) {
            console.error("⚠️ Lỗi ghi log:", logError.message);
        }

        return res.json({ success: true, message: "Đã xóa kho thành công!" });
    } catch (error) {
        console.error("Lỗi xóa kho:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getAllKho, getKhoById, createKho, updateKho, deleteKho };