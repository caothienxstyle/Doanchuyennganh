const { sql, poolPromise } = require("../db/data");
const { writeLog } = require("./logController");

const logTonKhoAction = async (req, hanhDong, noiDung) => {
    try {
        if (req.user?.id) {
            await writeLog(req.user.id, hanhDong, "TonKho", noiDung);
        }
    } catch (error) {
        console.error("💥 Lỗi ghi log tồn kho:", error.message);
    }
};
// Hàm lấy toàn bộ danh sách vị trí kho chuẩn định dạng Frontend yêu cầu
const getDanhSachViTriKho = async (req, res) => {
    try {
        const pool = await poolPromise;
        
        const result = await pool.request().query(`
            SELECT 
                MaViTri, -- LẤY THÊM TRƯỜNG ID GỐC NÀY NỮA BẠN NHÉ!
                MaKho, 
                MaViTriCode, 
                KhuVuc, 
                DayKe, 
                Tang, 
                OKe, 
                MoTa AS GhiChu,
                CONCAT(KhuVuc, ' / ', DayKe, ' / ', Tang, ' / ', OKe) AS TenViTriHienThi
            FROM ViTriKho
            ORDER BY MaKho ASC, MaViTriCode ASC
        `);

        return res.status(200).json(result.recordset);
    } catch (error) {
        console.error("💥 Lỗi khi lấy danh sách vị trí kho:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const resolveMaViTri = async (pool, MaKho, MaViTriCode) => {
    // Nếu truyền vào bản chất là một Số nguyên (ID), dùng luôn không cần SELECT chuỗi code nữa
    if (!isNaN(MaViTriCode) && Number.isInteger(Number(MaViTriCode))) {
        return parseInt(MaViTriCode);
    }

    const result = await pool.request()
        .input("MaKho", sql.Int, parseInt(MaKho))
        .input("MaViTriCode", sql.VarChar, String(MaViTriCode).trim())
        .query(`
            SELECT MaViTri
            FROM ViTriKho
            WHERE MaKho = @MaKho
              AND MaViTriCode = @MaViTriCode
        `);

    if (result.recordset.length === 0) {
        throw new Error(`Không tìm thấy mã vị trí "${MaViTriCode}" thuộc Kho mang ID ${MaKho}`);
    }

    return result.recordset[0].MaViTri;
};

const getTonKho = async (req, res) => {
    try {
        const { maKho, maSanPham } = req.query;
        const pool = await poolPromise;

        let query = `
            SELECT tk.MaKho, k.TenKho, tk.MaSanPham, sp.TenSanPham,
                   vk.MaViTriCode, vk.KhuVuc, vk.DayKe, vk.Tang, vk.OKe, vk.MoTa,
                   tk.SoLuongTon, tk.NgayCapNhat
            FROM TonKho tk
            LEFT JOIN Kho k ON tk.MaKho = k.MaKho
            LEFT JOIN SanPham sp ON tk.MaSanPham = sp.MaSanPham
            LEFT JOIN ViTriKho vk ON tk.MaViTri = vk.MaViTri
            WHERE 1 = 1
        `;

        const request = pool.request();

        if (maKho) {
            query += ` AND tk.MaKho = @maKho`;
            request.input("maKho", sql.Int, parseInt(maKho));
        }

        if (maSanPham) {
            query += ` AND tk.MaSanPham = @maSanPham`;
            request.input("maSanPham", sql.Int, parseInt(maSanPham));
        }

        query += ` ORDER BY tk.NgayCapNhat DESC`;

        const result = await request.query(query);

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getTonKhoById = async (req, res) => {
    try {
        const { maKho } = req.params;
        const { maSanPham } = req.query;
        const pool = await poolPromise;

        let query = `
            SELECT tk.MaKho, k.TenKho, tk.MaSanPham, sp.TenSanPham,
                   vk.MaViTriCode, vk.KhuVuc, vk.DayKe, vk.Tang, vk.OKe, vk.MoTa,
                   tk.SoLuongTon, tk.NgayCapNhat
            FROM TonKho tk
            LEFT JOIN Kho k ON tk.MaKho = k.MaKho
            LEFT JOIN SanPham sp ON tk.MaSanPham = sp.MaSanPham
            LEFT JOIN ViTriKho vk ON tk.MaViTri = vk.MaViTri
            WHERE tk.MaKho = @maKho
        `;

        const request = pool.request().input("maKho", sql.Int, parseInt(maKho));

        if (maSanPham) {
            query += ` AND tk.MaSanPham = @maSanPham`;
            request.input("maSanPham", sql.Int, parseInt(maSanPham));
        }

        query += ` ORDER BY tk.NgayCapNhat DESC`;

        const result = await request.query(query);

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createTonKho = async (req, res) => {
    try {
        const { MaKho, MaSanPham, MaViTriCode, SoLuongTon } = req.body;

        if (!MaKho || !MaSanPham || !MaViTriCode) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp MaKho, MaSanPham và MaViTriCode"
            });
        }

        const pool = await poolPromise;
        const MaViTri = await resolveMaViTri(pool, MaKho, MaViTriCode);

        await pool.request()
            .input("MaKho", sql.Int, parseInt(MaKho))
            .input("MaSanPham", sql.Int, parseInt(MaSanPham))
            .input("MaViTri", sql.Int, MaViTri)
            .input("SoLuongTon", sql.Int, parseInt(SoLuongTon || 0))
            .query(`
                INSERT INTO TonKho (MaKho, MaSanPham, MaViTri, SoLuongTon, NgayCapNhat)
                VALUES (@MaKho, @MaSanPham, @MaViTri, @SoLuongTon, GETDATE())
            `);

        await logTonKhoAction(req, "CREATE", `Tạo tồn kho: Kho=${MaKho}, Sản phẩm=${MaSanPham}, Vị trí=${MaViTriCode}, Số lượng=${SoLuongTon || 0}`);

        res.status(201).json({ success: true, message: "Tạo tồn kho thành công" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// FIX LỖI SỐ 2: Hàm Update thông minh (Tự động chuyển sang tạo mới nếu chưa có dữ liệu)
const updateTonKho = async (req, res) => {
    try {
        const { MaKho, MaSanPham, MaViTriCode, SoLuongTon } = req.body;

        if (!MaKho || !MaSanPham || !MaViTriCode) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp MaKho, MaSanPham và MaViTriCode"
            });
        }

        const pool = await poolPromise;
        const MaViTri = await resolveMaViTri(pool, MaKho, MaViTriCode);

        // 1. Thử cập nhật bản ghi cũ
        const result = await pool.request()
            .input("MaKho", sql.Int, parseInt(MaKho))
            .input("MaSanPham", sql.Int, parseInt(MaSanPham))
            .input("MaViTri", sql.Int, MaViTri)
            .input("SoLuongTon", sql.Int, parseInt(SoLuongTon || 0))
            .query(`
                UPDATE TonKho
                SET SoLuongTon = @SoLuongTon,
                    NgayCapNhat = GETDATE()
                WHERE MaKho = @MaKho
                  AND MaSanPham = @MaSanPham
                  AND MaViTri = @MaViTri
            `);

        // 2. Nếu rowsAffected[0] === 0 (Nghĩa là chưa từng tồn tại vị trí hàng hóa này) -> Thực hiện INSERT luôn
        if (result.rowsAffected[0] === 0) {
            await pool.request()
                .input("MaKho", sql.Int, parseInt(MaKho))
                .input("MaSanPham", sql.Int, parseInt(MaSanPham))
                .input("MaViTri", sql.Int, MaViTri)
                .input("SoLuongTon", sql.Int, parseInt(SoLuongTon || 0))
                .query(`
                    INSERT INTO TonKho (MaKho, MaSanPham, MaViTri, SoLuongTon, NgayCapNhat)
                    VALUES (@MaKho, @MaSanPham, @MaViTri, @SoLuongTon, GETDATE())
                `);

            await logTonKhoAction(req, "CREATE", `Khởi tạo tồn kho tự động: Kho=${MaKho}, Sản phẩm=${MaSanPham}, Vị trí=${MaViTriCode}, Số lượng=${SoLuongTon || 0}`);
            
            return res.status(200).json({
                success: true,
                message: "Vị trí tồn kho này chưa tồn tại, hệ thống đã tự động tạo mới thành công!"
            });
        }

        await logTonKhoAction(req, "UPDATE", `Cập nhật tồn kho: Kho=${MaKho}, Sản phẩm=${MaSanPham}, Vị trí=${MaViTriCode}, Số lượng=${SoLuongTon || 0}`);

        res.status(200).json({
            success: true,
            message: "Cập nhật số lượng tồn kho thành công"
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteTonKho = async (req, res) => {
    try {
        const { MaKho, MaSanPham, MaViTriCode } = req.body;

        if (!MaKho || !MaSanPham || !MaViTriCode) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp MaKho, MaSanPham và MaViTriCode"
            });
        }

        const pool = await poolPromise;
        const MaViTri = await resolveMaViTri(pool, MaKho, MaViTriCode);

        const result = await pool.request()
            .input("MaKho", sql.Int, parseInt(MaKho))
            .input("MaSanPham", sql.Int, parseInt(MaSanPham))
            .input("MaViTri", sql.Int, MaViTri)
            .query(`
                DELETE FROM TonKho
                WHERE MaKho = @MaKho
                  AND MaSanPham = @MaSanPham
                  AND MaViTri = @MaViTri
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tồn kho để xóa"
            });
        }

        await logTonKhoAction(req, "DELETE", `Xóa tồn kho: Kho=${MaKho}, Sản phẩm=${MaSanPham}, Vị trí=${MaViTriCode}`);

        res.status(200).json({ success: true, message: "Xóa tồn kho thành công" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getTonKho,
    getTonKhoById,
    createTonKho,
    updateTonKho,
    deleteTonKho,
    getDanhSachViTriKho
};