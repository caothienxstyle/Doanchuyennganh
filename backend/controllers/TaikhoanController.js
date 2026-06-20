const sql = require("mssql");
const bcrypt = require("bcrypt");
const { poolPromise } = require("../db/data");
const { writeLog } = require("./logController");

const SALT_ROUNDS = 10;

// GET /taikhoan/danhsach?trang=1&soLuong=10&tuKhoa=abc&trangThai=1
const getAllTaiKhoan = async (req, res) => {
    try {
        const pool = await poolPromise;
        const trang    = parseInt(req.query.trang)   || 1;
        const soLuong  = parseInt(req.query.soLuong) || 10;
        const tuKhoa   = req.query.tuKhoa            || "";
        const trangThai = req.query.trangThai;
        const offset   = (trang - 1) * soLuong;

        let where = "WHERE 1=1";
        if (tuKhoa)   where += ` AND (tk.TenDangNhap LIKE '%' + @tuKhoa + '%' OR nv.TenNhanVien LIKE N'%' + @tuKhoa + '%')`;
        if (trangThai !== undefined && trangThai !== "") where += " AND tk.TrangThai = @trangThai";

        const countReq = pool.request().input("tuKhoa", sql.VarChar, tuKhoa);
        if (trangThai !== undefined && trangThai !== "") countReq.input("trangThai", sql.Bit, parseInt(trangThai));

        const tongResult = await countReq.query(`
            SELECT COUNT(*) AS TongSo
            FROM TaiKhoan tk
            LEFT JOIN NhanVien nv ON tk.MaNhanVien = nv.MaNhanVien
            LEFT JOIN VaiTro   vt ON tk.MaVaiTro   = vt.MaVaiTro
            ${where}
        `);
        const tongSo = tongResult.recordset[0].TongSo;

        const dataReq = pool.request()
            .input("tuKhoa",  sql.VarChar, tuKhoa)
            .input("offset",  sql.Int,     offset)
            .input("soLuong", sql.Int,     soLuong);
        if (trangThai !== undefined && trangThai !== "") dataReq.input("trangThai", sql.Bit, parseInt(trangThai));

        const result = await dataReq.query(`
            SELECT
                tk.MaTaiKhoan,
                tk.TenDangNhap,
                tk.MaNhanVien,
                nv.TenNhanVien,
                nv.Email,
                nv.AnhDaiDien,
                tk.MaVaiTro,
                vt.TenVaiTro,
                tk.TrangThai,
                tk.SoLanDangNhapSai,
                tk.LanDangNhapCuoi,
                tk.CreatedAt,
                tk.UpdatedAt
            FROM TaiKhoan tk
            LEFT JOIN NhanVien nv ON tk.MaNhanVien = nv.MaNhanVien
            LEFT JOIN VaiTro   vt ON tk.MaVaiTro   = vt.MaVaiTro
            ${where}
            ORDER BY tk.CreatedAt DESC
            OFFSET @offset ROWS FETCH NEXT @soLuong ROWS ONLY
        `);

        return res.json({
            success: true,
            data: result.recordset,
            phanTrang: { trang, soLuong, tongSo, tongTrang: Math.ceil(tongSo / soLuong) }
        });
    } catch (error) {
        console.error("Lỗi lấy danh sách tài khoản:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /taikhoan/:id
const getTaiKhoanById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;

        const result = await pool.request()
            .input("MaTaiKhoan", sql.Int, parseInt(id))
            .query(`
                SELECT
                    tk.MaTaiKhoan,
                    tk.TenDangNhap,
                    tk.MaNhanVien,
                    nv.TenNhanVien,
                    nv.Email,
                    nv.SDT,
                    nv.AnhDaiDien,
                    tk.MaVaiTro,
                    vt.TenVaiTro,
                    tk.TrangThai,
                    tk.SoLanDangNhapSai,
                    tk.LanDangNhapCuoi,
                    tk.CreatedAt,
                    tk.UpdatedAt
                FROM TaiKhoan tk
                LEFT JOIN NhanVien nv ON tk.MaNhanVien = nv.MaNhanVien
                LEFT JOIN VaiTro   vt ON tk.MaVaiTro   = vt.MaVaiTro
                WHERE tk.MaTaiKhoan = @MaTaiKhoan
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản!" });
        }
        return res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        console.error("Lỗi lấy tài khoản:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /taikhoan/taomoi — Chỉ Admin
const createTaiKhoan = async (req, res) => {
    try {
        const { TenDangNhap, MatKhau, MaNhanVien, MaVaiTro } = req.body;
        const MaNhanVienThucHien = req.user.id;

        // Validation
        if (!TenDangNhap?.trim()) return res.status(400).json({ success: false, message: "Tên đăng nhập không được để trống!" });
        if (!MatKhau?.trim())    return res.status(400).json({ success: false, message: "Mật khẩu không được để trống!" });
        if (!MaNhanVien)         return res.status(400).json({ success: false, message: "Phải chọn nhân viên!" });
        if (!MaVaiTro)           return res.status(400).json({ success: false, message: "Phải chọn vai trò!" });
        if (MatKhau.length < 6)  return res.status(400).json({ success: false, message: "Mật khẩu phải có ít nhất 6 ký tự!" });

        const pool = await poolPromise;

        // Kiểm tra TenDangNhap trùng
        const checkTen = await pool.request()
            .input("TenDangNhap", sql.VarChar, TenDangNhap.trim())
            .query("SELECT MaTaiKhoan FROM TaiKhoan WHERE TenDangNhap = @TenDangNhap");
        if (checkTen.recordset.length > 0) {
            return res.status(409).json({ success: false, message: `Tên đăng nhập "${TenDangNhap}" đã tồn tại!` });
        }

        // Kiểm tra nhân viên đã có tài khoản chưa
        const checkNV = await pool.request()
            .input("MaNhanVien", sql.Int, parseInt(MaNhanVien))
            .query("SELECT MaTaiKhoan FROM TaiKhoan WHERE MaNhanVien = @MaNhanVien");
        if (checkNV.recordset.length > 0) {
            return res.status(409).json({ success: false, message: "Nhân viên này đã có tài khoản rồi!" });
        }

        // Kiểm tra nhân viên tồn tại
        const checkNVExist = await pool.request()
            .input("MaNhanVien", sql.Int, parseInt(MaNhanVien))
            .query("SELECT MaNhanVien, TenNhanVien FROM NhanVien WHERE MaNhanVien = @MaNhanVien AND IsDeleted = 0");
        if (checkNVExist.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên!" });
        }
        const tenNV = checkNVExist.recordset[0].TenNhanVien;

        // Kiểm tra vai trò tồn tại
        const checkVT = await pool.request()
            .input("MaVaiTro", sql.Int, parseInt(MaVaiTro))
            .query("SELECT MaVaiTro FROM VaiTro WHERE MaVaiTro = @MaVaiTro");
        if (checkVT.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy vai trò!" });
        }

        // Hash mật khẩu
        const hashedPassword = await bcrypt.hash(MatKhau.trim(), SALT_ROUNDS);

        const result = await pool.request()
            .input("TenDangNhap", sql.VarChar,  TenDangNhap.trim())
            .input("MatKhau",     sql.VarChar,  hashedPassword)
            .input("MaNhanVien",  sql.Int,      parseInt(MaNhanVien))
            .input("MaVaiTro",    sql.Int,      parseInt(MaVaiTro))
            .query(`
                INSERT INTO TaiKhoan (TenDangNhap, MatKhau, MaNhanVien, MaVaiTro)
                OUTPUT
                    INSERTED.MaTaiKhoan, INSERTED.TenDangNhap,
                    INSERTED.MaNhanVien, INSERTED.MaVaiTro,
                    INSERTED.TrangThai,  INSERTED.CreatedAt
                VALUES (@TenDangNhap, @MatKhau, @MaNhanVien, @MaVaiTro)
            `);

        const newTK = result.recordset[0];

        try {
            await writeLog(MaNhanVienThucHien, "Thêm mới", "TaiKhoan", `Admin tạo tài khoản "${TenDangNhap.trim()}" cho nhân viên: ${tenNV} (ID: ${newTK.MaTaiKhoan})`);
        } catch (logErr) {
            console.error("⚠️ Lỗi ghi log:", logErr.message);
        }

        return res.status(201).json({ success: true, message: "Tạo tài khoản thành công!", data: newTK });
    } catch (error) {
        console.error("Lỗi tạo tài khoản:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /taikhoan/capnhat/:id — Cập nhật vai trò (Admin)
const updateTaiKhoan = async (req, res) => {
    try {
        const { id } = req.params;
        const { MaVaiTro } = req.body;
        const MaNhanVienThucHien = req.user.id;

        if (!MaVaiTro) return res.status(400).json({ success: false, message: "MaVaiTro không được để trống!" });

        const pool = await poolPromise;

        const check = await pool.request()
            .input("MaTaiKhoan", sql.Int, parseInt(id))
            .query(`
                SELECT tk.MaTaiKhoan, tk.TenDangNhap, vt.TenVaiTro
                FROM TaiKhoan tk
                LEFT JOIN VaiTro vt ON tk.MaVaiTro = vt.MaVaiTro
                WHERE tk.MaTaiKhoan = @MaTaiKhoan
            `);

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản!" });
        }

        const { TenDangNhap, TenVaiTro: vaiTroCu } = check.recordset[0];

        // Kiểm tra vai trò mới tồn tại
        const checkVT = await pool.request()
            .input("MaVaiTro", sql.Int, parseInt(MaVaiTro))
            .query("SELECT TenVaiTro FROM VaiTro WHERE MaVaiTro = @MaVaiTro");
        if (checkVT.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy vai trò!" });
        }
        const vaiTroMoi = checkVT.recordset[0].TenVaiTro;

        await pool.request()
            .input("MaTaiKhoan", sql.Int, parseInt(id))
            .input("MaVaiTro",   sql.Int, parseInt(MaVaiTro))
            .query("UPDATE TaiKhoan SET MaVaiTro = @MaVaiTro, UpdatedAt = GETDATE() WHERE MaTaiKhoan = @MaTaiKhoan");

        try {
            await writeLog(MaNhanVienThucHien, "Cập nhật", "TaiKhoan", `Đổi vai trò tài khoản "${TenDangNhap}": "${vaiTroCu}" → "${vaiTroMoi}"`);
        } catch (logErr) {
            console.error("⚠️ Lỗi ghi log:", logErr.message);
        }

        return res.json({ success: true, message: "Cập nhật vai trò tài khoản thành công!" });
    } catch (error) {
        console.error("Lỗi cập nhật tài khoản:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// PATCH /taikhoan/doiMatKhau/:id — Admin đặt lại mật khẩu cho nhân viên
const resetMatKhau = async (req, res) => {
    try {
        const { id } = req.params;
        const { MatKhauMoi } = req.body;
        const MaNhanVienThucHien = req.user.id;

        if (!MatKhauMoi?.trim()) return res.status(400).json({ success: false, message: "Mật khẩu mới không được để trống!" });
        if (MatKhauMoi.length < 6) return res.status(400).json({ success: false, message: "Mật khẩu phải có ít nhất 6 ký tự!" });

        const pool = await poolPromise;

        const check = await pool.request()
            .input("MaTaiKhoan", sql.Int, parseInt(id))
            .query("SELECT MaTaiKhoan, TenDangNhap FROM TaiKhoan WHERE MaTaiKhoan = @MaTaiKhoan");

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản!" });
        }

        const { TenDangNhap } = check.recordset[0];
        const hashedPassword = await bcrypt.hash(MatKhauMoi.trim(), SALT_ROUNDS);

        await pool.request()
            .input("MaTaiKhoan", sql.Int,     parseInt(id))
            .input("MatKhau",    sql.VarChar, hashedPassword)
            .query(`
                UPDATE TaiKhoan
                SET MatKhau = @MatKhau, SoLanDangNhapSai = 0, UpdatedAt = GETDATE()
                WHERE MaTaiKhoan = @MaTaiKhoan
            `);

        try {
            await writeLog(MaNhanVienThucHien, "Cập nhật", "TaiKhoan", `Admin đặt lại mật khẩu cho tài khoản: "${TenDangNhap}"`);
        } catch (logErr) {
            console.error("⚠️ Lỗi ghi log:", logErr.message);
        }

        return res.json({ success: true, message: "Đặt lại mật khẩu thành công!" });
    } catch (error) {
        console.error("Lỗi đặt lại mật khẩu:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// PATCH /taikhoan/trangthai/:id — Khóa/mở tài khoản (Admin)
const updateTrangThai = async (req, res) => {
    try {
        const { id } = req.params;
        const { TrangThai } = req.body;
        const MaNhanVienThucHien = req.user.id;

        if (TrangThai === undefined) return res.status(400).json({ success: false, message: "TrangThai không được để trống!" });

        const pool = await poolPromise;

        // Đảm bảo ép kiểu boolean chính xác: chấp nhận cả boolean, string "true"/"false" hoặc number 1/0
        const isActionActive = (TrangThai === true || TrangThai === 'true' || TrangThai === 1 || TrangThai === '1');

        const check = await pool.request()
            .input("MaTaiKhoan", sql.Int, parseInt(id))
            .query("SELECT TenDangNhap FROM TaiKhoan WHERE MaTaiKhoan = @MaTaiKhoan");

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản!" });
        }

        const { TenDangNhap } = check.recordset[0];
        const label = isActionActive ? "mở khóa" : "khóa";

        await pool.request()
            .input("MaTaiKhoan",      sql.Int, parseInt(id))
            .input("TrangThai",       sql.Bit, isActionActive ? 1 : 0)
            .query(`
                UPDATE TaiKhoan
                SET TrangThai = @TrangThai,
                    SoLanDangNhapSai = CASE WHEN @TrangThai = 1 THEN 0 ELSE SoLanDangNhapSai END,
                    UpdatedAt = GETDATE()
                WHERE MaTaiKhoan = @MaTaiKhoan
            `);

        try {
            await writeLog(MaNhanVienThucHien, "Cập nhật", "TaiKhoan", `Admin đã ${label} tài khoản: "${TenDangNhap}"`);
        } catch (logErr) {
            console.error("⚠️ Lỗi ghi log:", logErr.message);
        }

        return res.json({ 
            success: true, 
            message: `Đã ${label} tài khoản thành công!`,
            data: { TrangThai: isActionActive } 
        });
    } catch (error) {
        console.error("Lỗi cập nhật trạng thái tài khoản:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /taikhoan/xoa/:id — Xóa tài khoản (Admin)
const deleteTaiKhoan = async (req, res) => {
    try {
        const { id } = req.params;
        const MaNhanVienThucHien = req.user.id;
        const pool = await poolPromise;

        const check = await pool.request()
            .input("MaTaiKhoan", sql.Int, parseInt(id))
            .query("SELECT TenDangNhap FROM TaiKhoan WHERE MaTaiKhoan = @MaTaiKhoan");

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản!" });
        }

        const { TenDangNhap } = check.recordset[0];

        await pool.request()
            .input("MaTaiKhoan", sql.Int, parseInt(id))
            .query("DELETE FROM TaiKhoan WHERE MaTaiKhoan = @MaTaiKhoan");

        try {
            await writeLog(MaNhanVienThucHien, "Xóa", "TaiKhoan", `Admin xóa tài khoản: "${TenDangNhap}" (ID: ${id})`);
        } catch (logErr) {
            console.error("⚠️ Lỗi ghi log:", logErr.message);
        }

        return res.json({ success: true, message: "Đã xóa tài khoản thành công!" });
    } catch (error) {
        console.error("Lỗi xóa tài khoản:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllTaiKhoan,
    getTaiKhoanById,
    createTaiKhoan,
    updateTaiKhoan,
    resetMatKhau,
    updateTrangThai,
    deleteTaiKhoan,
};