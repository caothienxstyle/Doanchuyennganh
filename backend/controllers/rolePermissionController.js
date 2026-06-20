const { sql, poolPromise } = require("../db/data");
const writeLog = require("./logController").writeLog;

// ==========================================
// I. CÁC API QUẢN LÝ QUYỀN HẠN (QUYENHAN)
// ==========================================

const getPermissions = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM QuyenHan ORDER BY MaQuyen ASC");
        
        return res.status(200).json({ success: true, count: result.recordset.length, data: result.recordset });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const createPermission = async (req, res) => {
    try {
        const { TenQuyen, MoTa } = req.body;

        if (!TenQuyen || TenQuyen.trim() === "") {
            return res.status(400).json({ success: false, message: "Lỗi: Tên quyền không được để trống!" });
        }

        const pool = await poolPromise;
        await pool.request()
            .input("TenQuyen", sql.NVarChar, TenQuyen.trim().toUpperCase()) // Viết hoa quyền hạn cho đồng bộ (Ví dụ: CREATE_PRODUCT)
            .input("MoTa", sql.NVarChar, MoTa || null)
            .query("INSERT INTO QuyenHan (TenQuyen, MoTa) VALUES (@TenQuyen, @MoTa)");

        // Ghi log
        const userId = req.user?.id || req.user?.maNhanVien || 1;
        try { await writeLog(userId, "Thêm mới", "QuyenHan", `Tạo quyền hạn mới: ${TenQuyen}`); } catch (le) {}

        return res.status(201).json({ success: true, message: "Tạo mới quyền hạn thành công!" });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: error.message.includes("UNIQUE") ? "Lỗi: Tên quyền hạn này đã tồn tại!" : error.message 
        });
    }
};

// ==========================================
// II. CÁC API QUẢN LÝ VAI TRÒ (VAITRO)
// ==========================================

const getRoles = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT vt.*, 
                (
                    SELECT qh.MaQuyen, qh.TenQuyen, qh.MoTa
                    FROM VaiTro_QuyenHan vtqh
                    JOIN QuyenHan qh ON vtqh.MaQuyen = qh.MaQuyen
                    WHERE vtqh.MaVaiTro = vt.MaVaiTro
                    FOR JSON PATH
                ) AS QuyenHan
            FROM VaiTro vt
            ORDER BY vt.MaVaiTro ASC
        `);

        const processedData = result.recordset.map(row => ({
            ...row,
            QuyenHan: row.QuyenHan ? JSON.parse(row.QuyenHan) : []
        }));

        return res.status(200).json({ success: true, count: processedData.length, data: processedData });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const createRole = async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        const { TenVaiTro, MoTa, DanhSachMaQuyen } = req.body;

        if (!TenVaiTro || TenVaiTro.trim() === "") {
            return res.status(400).json({ success: false, message: "Lỗi: Tên vai trò không được để trống!" });
        }

        await transaction.begin();

        const insertRoleResult = await new sql.Request(transaction)
            .input("TenVaiTro", sql.NVarChar, TenVaiTro.trim())
            .input("MoTa", sql.NVarChar, MoTa || null)
            .query("INSERT INTO VaiTro (TenVaiTro, MoTa) OUTPUT INSERTED.MaVaiTro VALUES (@TenVaiTro, @MoTa)");

        const newRoleId = insertRoleResult.recordset[0].MaVaiTro;

        if (Array.isArray(DanhSachMaQuyen) && DanhSachMaQuyen.length > 0) {
            for (const idQuyen of DanhSachMaQuyen) {
                await new sql.Request(transaction)
                    .input("MaVaiTro", sql.Int, newRoleId)
                    .input("MaQuyen", sql.Int, idQuyen)
                    .query("INSERT INTO VaiTro_QuyenHan (MaVaiTro, MaQuyen) VALUES (@MaVaiTro, @MaQuyen)");
            }
        }

        const userId = req.user?.id || req.user?.maNhanVien || 1;
        try { await writeLog(userId, "Thêm mới", "VaiTro", `Tạo vai trò: ${TenVaiTro}`); } catch (le) {}

        await transaction.commit();
        return res.status(201).json({ success: true, message: "Tạo vai trò và phân quyền thành công!" });

    } catch (error) {
        if (transaction._begun) await transaction.rollback();
        return res.status(500).json({ 
            success: false, 
            message: error.message.includes("UNIQUE") ? "Lỗi: Tên vai trò này đã tồn tại!" : error.message 
        });
    }
};

const updateRole = async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        const { MaVaiTro, TenVaiTro, MoTa, DanhSachMaQuyen } = req.body;

        if (!MaVaiTro) {
            return res.status(400).json({ success: false, message: "Lỗi: Thiếu MaVaiTro để cập nhật!" });
        }
        if (!TenVaiTro || TenVaiTro.trim() === "") {
            return res.status(400).json({ success: false, message: "Lỗi: Tên vai trò không được để trống!" });
        }

        await transaction.begin();

        await new sql.Request(transaction)
            .input("MaVaiTro", sql.Int, parseInt(MaVaiTro, 10))
            .input("TenVaiTro", sql.NVarChar, TenVaiTro.trim())
            .input("MoTa", sql.NVarChar, MoTa || null)
            .query("UPDATE VaiTro SET TenVaiTro = @TenVaiTro, MoTa = @MoTa WHERE MaVaiTro = @MaVaiTro");

        await new sql.Request(transaction)
            .input("MaVaiTro", sql.Int, parseInt(MaVaiTro, 10))
            .query("DELETE FROM VaiTro_QuyenHan WHERE MaVaiTro = @MaVaiTro");

        if (Array.isArray(DanhSachMaQuyen) && DanhSachMaQuyen.length > 0) {
            for (const idQuyen of DanhSachMaQuyen) {
                await new sql.Request(transaction)
                    .input("MaVaiTro", sql.Int, parseInt(MaVaiTro, 10))
                    .input("MaQuyen", sql.Int, idQuyen)
                    .query("INSERT INTO VaiTro_QuyenHan (MaVaiTro, MaQuyen) VALUES (@MaVaiTro, @MaQuyen)");
            }
        }

        const userId = req.user?.id || req.user?.maNhanVien || 1;
        try { await writeLog(userId, "Cập nhật", "VaiTro", `Cập nhật cấu hình vai trò: ${TenVaiTro}`); } catch (le) {}

        await transaction.commit();
        return res.status(200).json({ success: true, message: "Cập nhật cấu hình vai trò thành công!" });

    } catch (error) {
        if (transaction._begun) await transaction.rollback();
        return res.status(500).json({ success: false, message: error.message });
    }
};

const deleteRole = async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        const MaVaiTro = req.body.MaVaiTro || req.params.id;

        if (!MaVaiTro) {
            return res.status(400).json({ success: false, message: "Lỗi: Không nhận được MaVaiTro cần xóa!" });
        }

        await transaction.begin();

        await new sql.Request(transaction)
            .input("MaVaiTro", sql.Int, parseInt(MaVaiTro, 10))
            .query("DELETE FROM VaiTro_QuyenHan WHERE MaVaiTro = @MaVaiTro");

        const result = await new sql.Request(transaction)
            .input("MaVaiTro", sql.Int, parseInt(MaVaiTro, 10))
            .query("DELETE FROM VaiTro WHERE MaVaiTro = @MaVaiTro");

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Lỗi: Không tìm thấy vai trò yêu cầu để xóa!" });
        }

        const userId = req.user?.id || req.user?.maNhanVien || 1;
        try { await writeLog(userId, "Xóa", "VaiTro", `Xóa vai trò có ID: ${MaVaiTro}`); } catch (le) {}

        await transaction.commit();
        return res.status(200).json({ success: true, message: "Xóa vai trò khỏi hệ thống thành công!" });

    } catch (error) {
        if (transaction._begun) await transaction.rollback();
        return res.status(500).json({ 
            success: false, 
            message: error.message.includes("REFERENCE") 
                ? "Lỗi: Không thể xóa vai trò này vì đang có Nhân viên sử dụng!" 
                : error.message 
        });
    }
};

module.exports = {
    getPermissions,
    createPermission,
    getRoles,
    createRole,
    updateRole,
    deleteRole
};