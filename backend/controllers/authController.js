const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sql, poolPromise } = require("../db/data"); 

require("dotenv").config();

// LOGIN
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!"
            });
        }

        const pool = await poolPromise; // ← dùng pool thay vì sql.connect

    const result = await pool.request()
        .input("username", sql.VarChar, username)
        .query(`
            SELECT 
                tk.MaTaiKhoan,
                tk.TenDangNhap,
                tk.MatKhau,
                tk.TrangThai,
                tk.MaNhanVien,
                vt.TenVaiTro,
                nv.TenNhanVien,
                nv.CCCD,
                nv.TrangThai AS TrangThaiNV,
                nv.IsDeleted
            FROM TaiKhoan tk
            INNER JOIN VaiTro vt ON tk.MaVaiTro = vt.MaVaiTro
            INNER JOIN NhanVien nv ON tk.MaNhanVien = nv.MaNhanVien
            WHERE tk.TenDangNhap = @username
        `);

        if (result.recordset.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Tài khoản không tồn tại trên hệ thống!"
            });
        }

        const user = result.recordset[0];

        // 1. Kiểm tra trạng thái của Nhân viên liên kết
        if (user.IsDeleted || user.TrangThaiNV === 0 || user.TrangThaiNV === false) {
            return res.status(403).json({
                success: false,
                message: "Tài khoản không thể sử dụng do nhân viên đã nghỉ việc hoặc bị xóa!"
            });
        }

        // 2. Kiểm tra trạng thái khóa của riêng tài khoản (TrangThai = 0 là Khóa)
        if (user.TrangThai === 0 || user.TrangThai === false) {
            return res.status(403).json({
                success: false,
                message: "Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ Admin!"
            });
        }

        // So sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.MatKhau);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Mật khẩu đăng nhập không chính xác!"
            });
        }

        // Tạo token
            const token = jwt.sign(
                {
                    id:   user.MaNhanVien, // Đổi sang MaNhanVien để làm khóa ngoại ghi log cho chuẩn
                    role: user.TenVaiTro.trim(), // Thêm .trim() để xóa bỏ khoảng trắng thừa nếu có trong DB
                    tenNhanVien: user.TenNhanVien,
                    cccd: user.CCCD
                },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

        return res.status(200).json({
            success: true,
            message: "Đăng nhập thành công!",
            token,
            user: {
                id:       user.MaTaiKhoan,
                username: user.TenDangNhap,
                role:     user.TenVaiTro
            }
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// CHANGE PASSWORD
const changePassword = async (req, res) => {
    try {
     
        const { password, passwordnew } = req.body;
        const userId = req.user?.id;

        if (!password || !passwordnew) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đủ mật khẩu cũ và mới"
            });
        }

        if (passwordnew.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu mới phải có ít nhất 8 ký tự"
            });
        }

        const pool = await poolPromise; 

        // Lấy user hiện tại
        const result = await pool.request()
            .input("userId", sql.Int, userId)
            .query(`
                SELECT MaTaiKhoan, MatKhau
                FROM TaiKhoan
                WHERE MaNhanVien = @userId
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài khoản liên kết với nhân viên này"
            });
        }

        const user = result.recordset[0];

        // Kiểm tra mật khẩu cũ
        const isMatch = await bcrypt.compare(password, user.MatKhau);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu cũ không chính xác"
            });
        }

        // Hash mật khẩu mới
        const hashedPassword = await bcrypt.hash(passwordnew, 12);

        // Cập nhật mật khẩu mới
        await pool.request()
            .input("hashedPassword", sql.VarChar, hashedPassword)
            .input("maTaiKhoan",     sql.Int,      user.MaTaiKhoan) // Dùng đích danh MaTaiKhoan lấy từ DB ra để update cho chuẩn
            .query(`
                UPDATE TaiKhoan
                SET MatKhau   = @hashedPassword,
                    UpdatedAt = GETDATE()
                WHERE MaTaiKhoan = @maTaiKhoan
            `);

        return res.status(200).json({
            success: true,
            message: "Đổi mật khẩu tài khoản thành công"
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
//PROFILE
const getProfile = async (req, res) => {
  try {
    const pool = await poolPromise;

    // Lấy ID người dùng từ Token giải mã (Theo log của bạn là trường 'id')
    const idNhanVien = req.user?.id; 

    if (!idNhanVien) {
      return res.status(401).json({
        success: false,
        message: "Lỗi xác thực: Không tìm thấy ID Nhân viên trong mã Token!"
      });
    }

    // Thực hiện truy vấn kết hợp các bảng theo cấu trúc DB thực tế
    const result = await pool.request()
      .input("id", sql.Int, idNhanVien)
      .query(`
        SELECT
          tk.MaTaiKhoan,
          tk.TenDangNhap,
          tk.TrangThai AS TrangThaiTaiKhoan,
          vt.MaVaiTro,
          vt.TenVaiTro,   
          nv.MaNhanVien,  
          nv.TenNhanVien,
          nv.NgaySinh,
          nv.GioiTinh,
          nv.SDT,
          nv.Email,       
          nv.CCCD,
          nv.DiaChi,
          nv.AnhDaiDien,
          nv.TrangThai AS TrangThaiNhanVien,
          (
            SELECT qh.MaQuyen, qh.TenQuyen, qh.MoTa
            FROM VaiTro_QuyenHan vtqh
            JOIN QuyenHan qh ON vtqh.MaQuyen = qh.MaQuyen
            WHERE vtqh.MaVaiTro = tk.MaVaiTro
            FOR JSON PATH
          ) AS QuyenHan
        FROM TaiKhoan tk
        INNER JOIN VaiTro vt ON tk.MaVaiTro = vt.MaVaiTro
        INNER JOIN NhanVien nv ON tk.MaNhanVien = nv.MaNhanVien 
        -- 🌟 ĐÃ FIX: Lọc chính xác theo MaNhanVien để khớp với ID từ Token của bạn
        WHERE tk.MaNhanVien = @id 
      `);

    // Kiểm tra nếu không tồn tại dữ liệu
    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Lỗi: Không tìm thấy tài khoản nào liên kết với Mã Nhân Viên [${idNhanVien}].`
      });
    }

    const user = result.recordset[0];

    // Chuyển đổi định dạng chuỗi JSON quyền hạn thành mảng cho Front-End tiện xử lý
    user.QuyenHan = user.QuyenHan ? JSON.parse(user.QuyenHan) : [];

    return res.status(200).json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error("❌ Lỗi hệ thống tại API getProfile:", error.message); 
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tải thông tin hồ sơ: " + error.message
    });
  }
};
module.exports = { login, changePassword, getProfile};