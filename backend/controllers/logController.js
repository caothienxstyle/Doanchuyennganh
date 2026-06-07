const { sql, poolPromise } = require("../db/data");

const getDanhSachLog = async (req, res) => {
    try {
        const pool = await poolPromise;

        const trang    = parseInt(req.query.trang)   || 1;
        const soLuong  = parseInt(req.query.soLuong) || 10;
        const tuKhoa   = req.query.tuKhoa            || "";
        const hanhDong = req.query.hanhDong           || "";
        const tuNgay   = req.query.tuNgay             || "";
        const denNgay  = req.query.denNgay            || "";
        const offset   = (trang - 1) * soLuong;

        let whereClause = "WHERE 1=1";

        if (tuKhoa) {
            whereClause += ` AND (
                nv.TenNhanVien  LIKE N'%' + @tuKhoa + '%'
                OR ls.HanhDong  LIKE N'%' + @tuKhoa + '%'
                OR ls.BangTacDong LIKE N'%' + @tuKhoa + '%'
            )`;
        }
        if (hanhDong) whereClause += " AND ls.HanhDong   = @hanhDong";
        if (tuNgay)   whereClause += " AND CAST(ls.ThoiGian AS DATE) >= @tuNgay";
        if (denNgay)  whereClause += " AND CAST(ls.ThoiGian AS DATE) <= @denNgay";

        // Đếm tổng
        const tongResult = await pool.request()
            .input("tuKhoa",   sql.NVarChar, tuKhoa)
            .input("hanhDong", sql.NVarChar, hanhDong)
            .input("tuNgay",   sql.Date,     tuNgay  || null)
            .input("denNgay",  sql.Date,     denNgay || null)
            .query(`
                SELECT COUNT(*) AS TongSo
                FROM LichSuThaoTac ls
                LEFT JOIN NhanVien nv ON ls.MaNhanVien = nv.MaNhanVien
                ${whereClause}
            `);

        const tongSo = tongResult.recordset[0].TongSo;

        // Lấy danh sách
        const logsResult = await pool.request()
            .input("offset",   sql.Int,      offset)
            .input("soLuong",  sql.Int,      soLuong)
            .input("tuKhoa",   sql.NVarChar, tuKhoa)
            .input("hanhDong", sql.NVarChar, hanhDong)
            .input("tuNgay",   sql.Date,     tuNgay  || null)
            .input("denNgay",  sql.Date,     denNgay || null)
            .query(`
                SELECT
                    ls.MaLichSu,
                    ls.HanhDong,
                    ls.BangTacDong,
                    ls.MaBanGhi,
                    ls.NoiDungCu,
                    ls.NoiDungMoi,
                    ls.DiaChiIP,
                    ls.ThoiGian,
                    nv.TenNhanVien,
                    nv.Email,
                    nv.CCCD
                FROM LichSuThaoTac ls
                LEFT JOIN NhanVien nv ON ls.MaNhanVien = nv.MaNhanVien
                ${whereClause}
                ORDER BY ls.ThoiGian DESC
                OFFSET @offset ROWS
                FETCH NEXT @soLuong ROWS ONLY
            `);

        return res.status(200).json({
            success: true,
            data: {
                logs: logsResult.recordset,
                phanTrang: {
                    trang,
                    soLuong,
                    tongSo,
                    tongTrang: Math.ceil(tongSo / soLuong)
                }
            }
        });

    } catch (err) {
        console.error("Lỗi getDanhSachLog:", err);
        return res.status(500).json({
            success: false,
            message: "Lỗi server",
            error: err.message
        });
    }
};

const getChiTietLog = async (req, res) => {
    try {
        const pool  = await poolPromise;
        const maLog = parseInt(req.params.id);

        const result = await pool.request()
            .input("maLog", sql.Int, maLog)
            .query(`
                SELECT
                    ls.MaLichSu,
                    ls.HanhDong,
                    ls.BangTacDong,
                    ls.MaBanGhi,
                    ls.NoiDungCu,
                    ls.NoiDungMoi,
                    ls.DiaChiIP,
                    ls.ThoiGian,
                    nv.MaNhanVien,
                    nv.TenNhanVien,
                    nv.Email,
                    nv.CCCD
                FROM LichSuThaoTac ls
                LEFT JOIN NhanVien nv ON ls.MaNhanVien = nv.MaNhanVien
                WHERE ls.MaLichSu = @maLog
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy log"
            });
        }

        return res.status(200).json({
            success: true,
            data: result.recordset[0]
        });

    } catch (err) {
        console.error("Lỗi getChiTietLog:", err);
        return res.status(500).json({
            success: false,
            message: "Lỗi server",
            error: err.message
        });
    }
};

const getThongKeLog = async (req, res) => {
    try {
        const pool = await poolPromise;

        // Thống kê theo ngày 7 ngày qua
        const theoNgay = await pool.request().query(`
            SELECT
                CAST(ThoiGian AS DATE) AS Ngay,
                HanhDong,
                COUNT(*)               AS SoLuong
            FROM LichSuThaoTac
            WHERE ThoiGian >= DATEADD(DAY, -7, GETDATE())
            GROUP BY CAST(ThoiGian AS DATE), HanhDong
            ORDER BY Ngay ASC
        `);

        // Thống kê theo vai trò
        const theoVaiTro = await pool.request().query(`
            SELECT
                vt.TenVaiTro,
                COUNT(ls.MaLichSu) AS SoLuong
            FROM LichSuThaoTac ls
            LEFT JOIN NhanVien nv ON ls.MaNhanVien = nv.MaNhanVien
            LEFT JOIN TaiKhoan tk ON nv.MaNhanVien = tk.MaNhanVien
            LEFT JOIN VaiTro   vt ON tk.MaVaiTro   = vt.MaVaiTro
            WHERE ls.ThoiGian >= DATEADD(DAY, -7, GETDATE())
            GROUP BY vt.TenVaiTro
        `);

        // Tổng log hôm nay
        const homNay = await pool.request().query(`
            SELECT COUNT(*) AS TongHomNay
            FROM LichSuThaoTac
            WHERE CAST(ThoiGian AS DATE) = CAST(GETDATE() AS DATE)
        `);

        // Tổng tất cả
        const tongTat = await pool.request().query(`
            SELECT COUNT(*) AS TongTatCa
            FROM LichSuThaoTac
        `);

        return res.status(200).json({
            success: true,
            data: {
                theoNgay:   theoNgay.recordset,
                theoVaiTro: theoVaiTro.recordset,
                homNay:     homNay.recordset[0].TongHomNay,
                tongTatCa:  tongTat.recordset[0].TongTatCa
            }
        });

    } catch (err) {
        console.error("Lỗi getThongKeLog:", err);
        return res.status(500).json({
            success: false,
            message: "Lỗi server",
            error: err.message
        });
    }
};

const writeLog = async (maNhanVien, hanhDong, bangTacDong, noiDung) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("MaNhanVien", sql.Int, maNhanVien)
            .input("HanhDong", sql.NVarChar, hanhDong)
            .input("BangTacDong", sql.NVarChar, bangTacDong)
            .input("NoiDungMoi", sql.NVarChar, noiDung) // Dùng đúng cột NoiDungMoi theo cấu trúc của bạn
            .query(`
                INSERT INTO LichSuThaoTac (MaNhanVien, HanhDong, BangTacDong, NoiDungMoi, ThoiGian)
                VALUES (@MaNhanVien, @HanhDong, @BangTacDong, @NoiDungMoi, GETDATE())
            `);
    } catch (error) {
        console.error("💥 Lỗi ghi log tự động:", error.message);
    }
};


module.exports = { 
    getDanhSachLog, 
    getChiTietLog, 
    getThongKeLog,
    writeLog 
};