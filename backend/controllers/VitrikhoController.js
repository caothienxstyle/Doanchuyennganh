const sql = require("mssql");
const { poolPromise } = require("../db/data");
const { writeLog } = require("./logController");

// GET /vitrikho/danhsach?maKho=1
const getAllViTriKho = async (req, res) => {
    try {
        const { maKho } = req.query;
        const pool = await poolPromise;

        let query = `
            SELECT 
                vt.MaViTri,
                vt.MaKho,
                k.TenKho,
                vt.MaViTriCode,
                vt.KhuVuc,
                vt.DayKe,
                vt.Tang,
                vt.OKe,
                vt.MoTa,
                CONCAT_WS(' / ',
                    NULLIF(vt.KhuVuc, ''),
                    NULLIF(vt.DayKe,  ''),
                    NULLIF(vt.Tang,   ''),
                    NULLIF(vt.OKe,    '')
                ) AS TenViTriHienThi
            FROM ViTriKho vt
            INNER JOIN Kho k ON vt.MaKho = k.MaKho AND k.IsDeleted = 0
        `;

        const request = pool.request();
        if (maKho) {
            query += " WHERE vt.MaKho = @MaKho";
            request.input("MaKho", sql.Int, parseInt(maKho));
        }
        query += " ORDER BY vt.MaKho ASC, vt.MaViTriCode ASC";

        const result = await request.query(query);
        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error("Lỗi lấy danh sách vị trí kho:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /vitrikho/theo-kho/:maKho
const getViTriByMaKho = async (req, res) => {
    try {
        const { maKho } = req.params;
        const pool = await poolPromise;

        const result = await pool.request()
            .input("MaKho", sql.Int, parseInt(maKho))
            .query(`
                SELECT 
                    vt.MaViTri, vt.MaKho, k.TenKho,
                    vt.MaViTriCode, vt.KhuVuc, vt.DayKe,
                    vt.Tang, vt.OKe, vt.MoTa,
                    CONCAT_WS(' / ',
                        NULLIF(vt.KhuVuc, ''),
                        NULLIF(vt.DayKe,  ''),
                        NULLIF(vt.Tang,   ''),
                        NULLIF(vt.OKe,    '')
                    ) AS TenViTriHienThi
                FROM ViTriKho vt
                INNER JOIN Kho k ON vt.MaKho = k.MaKho AND k.IsDeleted = 0
                WHERE vt.MaKho = @MaKho
                ORDER BY vt.MaViTriCode ASC
            `);

        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error("Lỗi lấy vị trí theo kho:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /vitrikho/:id
const getViTriById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;

        const result = await pool.request()
            .input("MaViTri", sql.Int, parseInt(id))
            .query(`
                SELECT 
                    vt.MaViTri, vt.MaKho, k.TenKho,
                    vt.MaViTriCode, vt.KhuVuc, vt.DayKe,
                    vt.Tang, vt.OKe, vt.MoTa,
                    CONCAT_WS(' / ',
                        NULLIF(vt.KhuVuc, ''),
                        NULLIF(vt.DayKe,  ''),
                        NULLIF(vt.Tang,   ''),
                        NULLIF(vt.OKe,    '')
                    ) AS TenViTriHienThi
                FROM ViTriKho vt
                INNER JOIN Kho k ON vt.MaKho = k.MaKho
                WHERE vt.MaViTri = @MaViTri
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy vị trí kho!" });
        }
        return res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        console.error("Lỗi lấy vị trí kho:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /vitrikho/taomoi
const createViTriKho = async (req, res) => {
    try {
        const { MaKho, MaViTriCode, KhuVuc, DayKe, Tang, OKe, MoTa } = req.body;
        const MaNhanVien = req.user.id;

        if (!MaKho) {
            return res.status(400).json({ success: false, message: "MaKho không được để trống!" });
        }
        if (!MaViTriCode?.trim()) {
            return res.status(400).json({ success: false, message: "MaViTriCode không được để trống!" });
        }

        const pool = await poolPromise;

        const checkDup = await pool.request()
            .input("MaViTriCode", sql.VarChar, MaViTriCode.trim())
            .query("SELECT MaViTri FROM ViTriKho WHERE MaViTriCode = @MaViTriCode");

        if (checkDup.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: `Mã vị trí "${MaViTriCode}" đã tồn tại trong hệ thống!`
            });
        }

        const checkKho = await pool.request()
            .input("MaKho", sql.Int, parseInt(MaKho))
            .query("SELECT MaKho FROM Kho WHERE MaKho = @MaKho AND IsDeleted = 0");

        if (checkKho.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Kho không tồn tại hoặc đã bị xóa!" });
        }

        const result = await pool.request()
            .input("MaKho",       sql.Int,      parseInt(MaKho))
            .input("MaViTriCode", sql.VarChar,  MaViTriCode.trim())
            .input("KhuVuc",      sql.NVarChar, KhuVuc?.trim() || null)
            .input("DayKe",       sql.NVarChar, DayKe?.trim()  || null)
            .input("Tang",        sql.NVarChar, Tang?.trim()   || null)
            .input("OKe",         sql.NVarChar, OKe?.trim()    || null)
            .input("MoTa",        sql.NVarChar, MoTa?.trim()   || null)
            .query(`
                INSERT INTO ViTriKho (MaKho, MaViTriCode, KhuVuc, DayKe, Tang, OKe, MoTa)
                OUTPUT 
                    INSERTED.MaViTri, INSERTED.MaKho, INSERTED.MaViTriCode,
                    INSERTED.KhuVuc,  INSERTED.DayKe, INSERTED.Tang,
                    INSERTED.OKe,     INSERTED.MoTa
                VALUES (@MaKho, @MaViTriCode, @KhuVuc, @DayKe, @Tang, @OKe, @MoTa)
            `);

        const newViTri = result.recordset[0];

        try {
            await writeLog(MaNhanVien, "Thêm mới", "ViTriKho", `Tạo vị trí mới: ${MaViTriCode.trim()} thuộc Kho ID ${MaKho}`);
        } catch (logError) {
            console.error("⚠️ Lỗi ghi log:", logError.message);
        }

        return res.status(201).json({ success: true, message: "Tạo vị trí kho mới thành công!", data: newViTri });
    } catch (error) {
        console.error("Lỗi tạo vị trí kho:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /vitrikho/taonhieu
const createManyViTriKho = async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        const { MaKho, DanhSach } = req.body;
        const MaNhanVien = req.user.id;

        if (!MaKho) {
            return res.status(400).json({ success: false, message: "MaKho không được để trống!" });
        }
        if (!Array.isArray(DanhSach) || DanhSach.length === 0) {
            return res.status(400).json({ success: false, message: "DanhSach phải có ít nhất 1 vị trí!" });
        }

        const checkKho = await pool.request()
            .input("MaKho", sql.Int, parseInt(MaKho))
            .query("SELECT MaKho FROM Kho WHERE MaKho = @MaKho AND IsDeleted = 0");

        if (checkKho.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Kho không tồn tại hoặc đã bị xóa!" });
        }

        await transaction.begin();

        const inserted = [];
        const skipped  = [];

        for (const item of DanhSach) {
            if (!item.MaViTriCode?.trim()) continue;

            const checkDup = await new sql.Request(transaction)
                .input("MaViTriCode", sql.VarChar, item.MaViTriCode.trim())
                .query("SELECT MaViTri FROM ViTriKho WHERE MaViTriCode = @MaViTriCode");

            if (checkDup.recordset.length > 0) {
                skipped.push(item.MaViTriCode.trim());
                continue;
            }

            const result = await new sql.Request(transaction)
                .input("MaKho",       sql.Int,      parseInt(MaKho))
                .input("MaViTriCode", sql.VarChar,  item.MaViTriCode.trim())
                .input("KhuVuc",      sql.NVarChar, item.KhuVuc?.trim() || null)
                .input("DayKe",       sql.NVarChar, item.DayKe?.trim()  || null)
                .input("Tang",        sql.NVarChar, item.Tang?.trim()   || null)
                .input("OKe",         sql.NVarChar, item.OKe?.trim()    || null)
                .input("MoTa",        sql.NVarChar, item.MoTa?.trim()   || null)
                .query(`
                    INSERT INTO ViTriKho (MaKho, MaViTriCode, KhuVuc, DayKe, Tang, OKe, MoTa)
                    OUTPUT INSERTED.MaViTri, INSERTED.MaViTriCode
                    VALUES (@MaKho, @MaViTriCode, @KhuVuc, @DayKe, @Tang, @OKe, @MoTa)
                `);

            inserted.push(result.recordset[0]);
        }

        await transaction.commit();

        try {
            await writeLog(MaNhanVien, "Thêm mới", "ViTriKho", `Bulk insert ${inserted.length} vị trí vào Kho ID ${MaKho}. Bỏ qua ${skipped.length} trùng mã.`);
        } catch (logError) {
            console.error("⚠️ Lỗi ghi log:", logError.message);
        }

        return res.status(201).json({
            success: true,
            message: `Đã thêm ${inserted.length} vị trí. Bỏ qua ${skipped.length} vị trí trùng mã.`,
            data: { inserted, skipped }
        });
    } catch (error) {
        try { if (transaction._begun) await transaction.rollback(); } catch (_) {}
        console.error("Lỗi bulk insert vị trí kho:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /vitrikho/capnhat/:id
const updateViTriKho = async (req, res) => {
    try {
        const { id } = req.params;
        const { KhuVuc, DayKe, Tang, OKe, MoTa } = req.body;
        const MaNhanVien = req.user.id;

        const pool = await poolPromise;

        const check = await pool.request()
            .input("MaViTri", sql.Int, parseInt(id))
            .query("SELECT MaViTri, MaViTriCode FROM ViTriKho WHERE MaViTri = @MaViTri");

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy vị trí cần cập nhật!" });
        }

        const maCode = check.recordset[0].MaViTriCode;

        await pool.request()
            .input("MaViTri", sql.Int,      parseInt(id))
            .input("KhuVuc",  sql.NVarChar, KhuVuc?.trim() || null)
            .input("DayKe",   sql.NVarChar, DayKe?.trim()  || null)
            .input("Tang",    sql.NVarChar, Tang?.trim()   || null)
            .input("OKe",     sql.NVarChar, OKe?.trim()    || null)
            .input("MoTa",    sql.NVarChar, MoTa?.trim()   || null)
            .query(`
                UPDATE ViTriKho
                SET KhuVuc = @KhuVuc, DayKe = @DayKe, Tang = @Tang, OKe = @OKe, MoTa = @MoTa
                WHERE MaViTri = @MaViTri
            `);

        try {
            await writeLog(MaNhanVien, "Cập nhật", "ViTriKho", `Cập nhật vị trí ${maCode} (ID: ${id})`);
        } catch (logError) {
            console.error("⚠️ Lỗi ghi log:", logError.message);
        }

        return res.json({ success: true, message: "Cập nhật vị trí kho thành công!" });
    } catch (error) {
        console.error("Lỗi cập nhật vị trí kho:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /vitrikho/xoa/:id
const deleteViTriKho = async (req, res) => {
    try {
        const { id } = req.params;
        const MaNhanVien = req.user.id;
        const pool = await poolPromise;

        const checkUsed = await pool.request()
            .input("MaViTri", sql.Int, parseInt(id))
            .query("SELECT COUNT(*) AS SoDung FROM ChiTietPhieuNhap WHERE MaViTri = @MaViTri");

        if (checkUsed.recordset[0].SoDung > 0) {
            return res.status(400).json({
                success: false,
                message: "Không thể xóa vị trí này vì đang được sử dụng trong phiếu nhập hàng!"
            });
        }

        const check = await pool.request()
            .input("MaViTri", sql.Int, parseInt(id))
            .query("SELECT MaViTriCode FROM ViTriKho WHERE MaViTri = @MaViTri");

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy vị trí kho!" });
        }

        const maCode = check.recordset[0].MaViTriCode;

        await pool.request()
            .input("MaViTri", sql.Int, parseInt(id))
            .query("DELETE FROM ViTriKho WHERE MaViTri = @MaViTri");

        try {
            await writeLog(MaNhanVien, "Xóa", "ViTriKho", `Xóa vị trí ${maCode} (ID: ${id})`);
        } catch (logError) {
            console.error("⚠️ Lỗi ghi log:", logError.message);
        }

        return res.json({ success: true, message: "Đã xóa vị trí kho thành công!" });
    } catch (error) {
        console.error("Lỗi xóa vị trí kho:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllViTriKho,
    getViTriByMaKho,
    getViTriById,
    createViTriKho,
    createManyViTriKho,
    updateViTriKho,
    deleteViTriKho,
};