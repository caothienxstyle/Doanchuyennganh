const { sql, poolPromise } = require("../db/data");
const bcrypt = require("bcryptjs");

const taoTaiKhoan = async (req, res) => {
    const {
        tenDangNhap,
        matKhau,
        vaiTro,
        tenNhanVien,
        ngaySinh,
        gioiTinh,
        sdt,
        email,
        cccd,
        diaChi,
        anhDaiDien
    } = req.body;
const pool = await poolPromise;
    if (!tenDangNhap || !matKhau || !vaiTro || !tenNhanVien) {
        return res.status(400).json({
            success: false,
            message: "Thiếu thông tin bắt buộc: tenDangNhap, matKhau, vaiTro, tenNhanVien"
        });
    }

    if (matKhau.length < 8) {
        return res.status(400).json({
            success: false,
            message: "Mật khẩu phải có ít nhất 8 ký tự"
        });
    }

    const vaiTroHopLe = ["Admin", "Quản lý kho", "Nhân viên kho"];
    if (!vaiTroHopLe.includes(vaiTro)) {
        return res.status(400).json({
            success: false,
            message: `Vai trò không hợp lệ. Chỉ chấp nhận: ${vaiTroHopLe.join(", ")}`
        });
    }

    if (sdt && (sdt.length < 10 || sdt.length > 11)) {
        return res.status(400).json({
            success: false,
            message: "Số điện thoại phải có 10-11 số"
        });
    }

    // --- Validate Email nếu có ---
    if (email && !email.includes("@")) {
        return res.status(400).json({
            success: false,
            message: "Email không hợp lệ"
        });
    }

    try {
        const pool = await poolPromise;

        // --- Kiểm tra tên đăng nhập ---
        const kiemTraTen = await pool.request()
            .input("tenDangNhap", sql.VarChar, tenDangNhap)
            .query(`
                SELECT MaTaiKhoan FROM TaiKhoan 
                WHERE TenDangNhap = @tenDangNhap
            `);

        if (kiemTraTen.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Tên đăng nhập đã tồn tại"
            });
        }

        // --- Kiểm tra Email trùng ---
        if (email) {
            const kiemTraEmail = await pool.request()
                .input("email", sql.VarChar, email)
                .query(`
                    SELECT MaNhanVien FROM NhanVien 
                    WHERE Email = @email AND IsDeleted = 0
                `);

            if (kiemTraEmail.recordset.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Email đã được sử dụng"
                });
            }
        }

        // --- Kiểm tra CCCD trùng ---
        if (cccd) {
            const kiemTraCCCD = await pool.request()
                .input("cccd", sql.VarChar, cccd)
                .query(`
                    SELECT MaNhanVien FROM NhanVien 
                    WHERE CCCD = @cccd AND IsDeleted = 0
                `);

            if (kiemTraCCCD.recordset.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "CCCD đã được sử dụng"
                });
            }
        }

        // --- Lấy MaVaiTro ---
        const vaiTroRow = await pool.request()
            .input("tenVaiTro", sql.NVarChar, vaiTro)
            .query(`
                SELECT MaVaiTro FROM VaiTro 
                WHERE TenVaiTro = @tenVaiTro
            `);

        if (vaiTroRow.recordset.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Vai trò không tìm thấy trong hệ thống"
            });
        }

        const maVaiTro = vaiTroRow.recordset[0].MaVaiTro;

        // --- Hash mật khẩu (bcrypt tự nhúng salt vào hash) ---
        const matKhauHash = await bcrypt.hash(matKhau, 12);

        // --- Transaction ---
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Tạo NhanVien
            const nhanVienResult = await transaction.request()
                .input("tenNhanVien", sql.NVarChar, tenNhanVien)
                .input("ngaySinh",    sql.Date,     ngaySinh    || null)
                .input("gioiTinh",    sql.Bit,      gioiTinh    ?? null)
                .input("sdt",         sql.VarChar,  sdt         || null)
                .input("email",       sql.VarChar,  email       || null)
                .input("cccd",        sql.VarChar,  cccd        || null)
                .input("diaChi",      sql.NVarChar, diaChi      || null)
                .input("anhDaiDien",  sql.NVarChar, anhDaiDien  || null)
                .query(`
                    INSERT INTO NhanVien 
                        (TenNhanVien, NgaySinh, GioiTinh, SDT, Email, CCCD, DiaChi, AnhDaiDien)
                    OUTPUT 
                        INSERTED.MaNhanVien,
                        INSERTED.TenNhanVien,
                        INSERTED.NgaySinh,
                        INSERTED.GioiTinh,
                        INSERTED.SDT,
                        INSERTED.Email,
                        INSERTED.CCCD,
                        INSERTED.DiaChi,
                        INSERTED.TrangThai,
                        INSERTED.CreatedAt
                    VALUES 
                        (@tenNhanVien, @ngaySinh, @gioiTinh, @sdt, @email, @cccd, @diaChi, @anhDaiDien)
                `);

            const nhanVien = nhanVienResult.recordset[0];

            // Tạo TaiKhoan
            const taiKhoanResult = await transaction.request()
                .input("tenDangNhap", sql.VarChar, tenDangNhap)
                .input("matKhau",     sql.VarChar, matKhauHash)
                .input("maNhanVien",  sql.Int,     nhanVien.MaNhanVien)
                .input("maVaiTro",    sql.Int,     maVaiTro)
                .query(`
                    INSERT INTO TaiKhoan 
                        (TenDangNhap, MatKhau, MaNhanVien, MaVaiTro)
                    OUTPUT 
                        INSERTED.MaTaiKhoan,
                        INSERTED.TenDangNhap,
                        INSERTED.TrangThai,
                        INSERTED.CreatedAt
                    VALUES 
                        (@tenDangNhap, @matKhau, @maNhanVien, @maVaiTro)
                `);

            const taiKhoan = taiKhoanResult.recordset[0];

            await transaction.commit();

            return res.status(201).json({
                success: true,
                message: "Tạo tài khoản thành công",
                data: {
                    taiKhoan: {
                        maTaiKhoan:  taiKhoan.MaTaiKhoan,
                        tenDangNhap: taiKhoan.TenDangNhap,
                        vaiTro:      vaiTro,
                        trangThai:   taiKhoan.TrangThai,
                        createdAt:   taiKhoan.CreatedAt
                    },
                    nhanVien: {
                        maNhanVien:  nhanVien.MaNhanVien,
                        tenNhanVien: nhanVien.TenNhanVien,
                        ngaySinh:    nhanVien.NgaySinh,
                        gioiTinh:    nhanVien.GioiTinh,
                        sdt:         nhanVien.SDT,
                        email:       nhanVien.Email,
                        cccd:        nhanVien.CCCD,
                        diaChi:      nhanVien.DiaChi,
                        trangThai:   nhanVien.TrangThai,
                        createdAt:   nhanVien.CreatedAt
                    }
                }
            });

        } catch (errInner) {
            await transaction.rollback();
            throw errInner;
        }

    } catch (err) {
        console.error("Lỗi taoTaiKhoan:", err);
        return res.status(500).json({
            success: false,
            message: "Lỗi server",
            error: err.message
        });
    }
};

module.exports = { taoTaiKhoan };