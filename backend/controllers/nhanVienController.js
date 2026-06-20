const sql = require('mssql');
// Hãy đảm bảo đường dẫn import poolPromise này đúng với cấu hình dự án của bạn
const { poolPromise } = require('../db/data');

const getAllNhanVien = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`
                SELECT 
                    nv.MaNhanVien, 
                    nv.TenNhanVien, 
                    nv.NgaySinh, 
                    nv.GioiTinh, 
                    nv.SDT, 
                    nv.Email, 
                    nv.CCCD, 
                    nv.DiaChi, 
                    nv.AnhDaiDien, 
                    nv.TrangThai, 
                    nv.CreatedAt,
                    tk.MaVaiTro  -- 🌟 THÊM CỘT NÀY ĐỂ FRONTEND CÓ THỂ LỌC ĐƯỢC ADMIN
                FROM NhanVien nv
                LEFT JOIN TaiKhoan tk ON nv.MaNhanVien = tk.MaNhanVien
                WHERE nv.IsDeleted = 0 
                ORDER BY nv.MaNhanVien DESC
            `);
        
        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error("Lỗi lấy danh sách nhân viên:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

// =========================================================================
// 2. LẤY CHI TIẾT MỘT NHÂN VIÊN THEO ID
// =========================================================================
const getNhanVienById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;
        
        const result = await pool.request()
            .input("MaNhanVien", sql.Int, id)
            .query(`
                SELECT MaNhanVien, TenNhanVien, NgaySinh, GioiTinh, SDT, Email, CCCD, DiaChi, AnhDaiDien, TrangThai, CreatedAt, UpdatedAt
                FROM NhanVien 
                WHERE MaNhanVien = @MaNhanVien AND IsDeleted = 0
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên hoặc nhân viên đã bị xóa!" });
        }

        return res.status(200).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        console.error("Lỗi lấy chi tiết nhân viên:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

// =========================================================================
// 3. THÊM MỚI NHÂN VIÊN + GHI LỊCH SỬ THAO TÁC (Có Transaction)
// =========================================================================
const createNhanVien = async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        const { TenNhanVien, NgaySinh, GioiTinh, SDT, Email, CCCD, DiaChi,  TrangThai } = req.body;
        const uploadedFile = req.file;
        const AnhDaiDien = uploadedFile ? `/uploads/employees/${uploadedFile.filename}` : null;
        // Validation chặn lỗi ràng buộc (Constraints) từ DB
        if (!TenNhanVien || TenNhanVien.trim() === "") {
            return res.status(400).json({ success: false, message: "Lỗi: Tên nhân viên không được để trống!" });
        }
        if (SDT && (SDT.length < 10 || SDT.length > 11)) {
            return res.status(400).json({ success: false, message: "Lỗi: Số điện thoại phải từ 10 đến 11 ký số!" });
        }
        if (Email && !Email.includes('@')) {
            return res.status(400).json({ success: false, message: "Lỗi: Email không đúng định dạng (thiếu ký tự @)!" });
        }

        // Bắt đầu Transaction phối hợp ghi Log
        await transaction.begin();
        
        // Bước A: Thêm thông tin nhân viên vào DB
        const result = await new sql.Request(transaction)
            .input("TenNhanVien", sql.NVarChar, TenNhanVien.trim())
            .input("NgaySinh", sql.Date, NgaySinh || null)
            .input("GioiTinh", sql.Bit, GioiTinh !== undefined ? GioiTinh : 1)
            .input("SDT", sql.VarChar, SDT || null)
            .input("Email", sql.VarChar, Email || null)
            .input("CCCD", sql.VarChar, CCCD || null)
            .input("DiaChi", sql.NVarChar, DiaChi || null)
            .input("AnhDaiDien", sql.NVarChar, AnhDaiDien || null)
            .input("TrangThai", sql.Bit, TrangThai !== undefined ? TrangThai : 1)
            .query(`
                INSERT INTO NhanVien (TenNhanVien, NgaySinh, GioiTinh, SDT, Email, CCCD, DiaChi, AnhDaiDien, TrangThai)
                OUTPUT INSERTED.MaNhanVien
                VALUES (@TenNhanVien, @NgaySinh, @GioiTinh, @SDT, @Email, @CCCD, @DiaChi, @AnhDaiDien, @TrangThai)
            `);

        const MaNhanVienMoi = result.recordset[0].MaNhanVien;

        // Bước B: Tự động ghi nhận vào bảng LichSuThaoTac (Lấy ID người dùng từ Token)
        const maNguoiThaoTac = req.user?.id || req.user?.maNhanVien || 1; 
        
        await new sql.Request(transaction)
            .input("MaNhanVienLog", sql.Int, maNguoiThaoTac)
            .input("HanhDong", sql.NVarChar, "CREATE")
            .input("BangTacDong", sql.NVarChar, "NhanVien")
            .input("NoiDungMoi", sql.NVarChar, `Thêm nhân viên mới: ${TenNhanVien.trim()} (Mã ID: ${MaNhanVienMoi})`)
            .query(`
                INSERT INTO LichSuThaoTac(MaNhanVien, HanhDong, BangTacDong, NoiDungMoi)
                VALUES(@MaNhanVienLog, @HanhDong, @BangTacDong, @NoiDungMoi)
            `);

        // Hoàn tất lưu dữ liệu thành công
        await transaction.commit();

        return res.status(201).json({
            success: true,
            message: "Thêm nhân viên mới và ghi nhận nhật ký hệ thống thành công!",
            data: { MaNhanVien: MaNhanVienMoi }
        });

    } catch (error) {
        // Rollback nếu có bất kỳ sự cố nào xảy ra trong chuỗi tiến trình
        if (transaction._begun) await transaction.rollback();
        
        console.error("Lỗi thêm nhân viên:", error);
        
        // Trả về thông báo lỗi chi tiết khi trùng UNIQUE (Email / CCCD)
        if (error.message.includes("Violation of UNIQUE KEY constraint")) {
            return res.status(400).json({ success: false, message: "Lỗi: Số CCCD hoặc Email này đã tồn tại trong hệ thống!" });
        }
        return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

// =========================================================================
// 4. CẬP NHẬT THÔNG TIN NHÂN VIÊN + GHI LỊCH SỬ THAO TÁC (Có Transaction)
// =========================================================================
const updateNhanVien = async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        const { id } = req.params;
        const { TenNhanVien, NgaySinh, GioiTinh, SDT, Email, CCCD, DiaChi, TrangThai } = req.body;
        
        let AnhDaiDien = null;

if (req.file) {
    AnhDaiDien = `/uploads/employees/${req.file.filename}`;
} else {
    const oldImage = await pool.request()
        .input("MaNhanVien", sql.Int, id)
        .query(`
            SELECT AnhDaiDien
            FROM NhanVien
            WHERE MaNhanVien = @MaNhanVien
        `);

    AnhDaiDien =
        oldImage.recordset.length > 0
            ? oldImage.recordset[0].AnhDaiDien
            : null;
}

        if (!TenNhanVien || TenNhanVien.trim() === "") {
            return res.status(400).json({ success: false, message: "Lỗi: Tên nhân viên không được để trống!" });
        }
        if (SDT && (SDT.length < 10 || SDT.length > 11)) {
            return res.status(400).json({ success: false, message: "Lỗi: Số điện thoại phải từ 10 đến 11 ký số!" });
        }
        if (Email && !Email.includes('@')) {
            return res.status(400).json({ success: false, message: "Lỗi: Email phải chứa ký tự @!" });
        }

        await transaction.begin();

        // Bước A: Thực hiện câu lệnh cập nhật thông tin
        const result = await new sql.Request(transaction)
            .input("MaNhanVien", sql.Int, id)
            .input("TenNhanVien", sql.NVarChar, TenNhanVien.trim())
            .input("NgaySinh", sql.Date, NgaySinh || null)
            .input("GioiTinh", sql.Bit, GioiTinh)
            .input("SDT", sql.VarChar, SDT || null)
            .input("Email", sql.VarChar, Email || null)
            .input("CCCD", sql.VarChar, CCCD || null)
            .input("DiaChi", sql.NVarChar, DiaChi || null)
            .input("AnhDaiDien", sql.NVarChar, AnhDaiDien || null)
            .input("TrangThai", sql.Bit, (TrangThai === true || TrangThai === 'true' || TrangThai === 1 || TrangThai === '1') ? 1 : 0)
            .query(`
                UPDATE NhanVien
                SET TenNhanVien = @TenNhanVien,
                    NgaySinh = @NgaySinh,
                    GioiTinh = @GioiTinh,
                    SDT = @SDT,
                    Email = @Email,
                    CCCD = @CCCD,
                    DiaChi = @DiaChi,
                    AnhDaiDien = @AnhDaiDien,
                    TrangThai = @TrangThai,
                    UpdatedAt = GETDATE()
                WHERE MaNhanVien = @MaNhanVien AND IsDeleted = 0
            `);

        // Nếu không có dòng nào bị ảnh hưởng (ID không tồn tại hoặc đã bị xóa mềm)
        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Không tìm thấy thông tin nhân viên hoặc tài khoản đã bị xóa trước đó!" });
        }

        // Bước B: Ghi log lịch sử cập nhật dữ liệu
        const maNguoiThaoTac = req.user?.id || req.user?.maNhanVien || 1;

        await new sql.Request(transaction)
            .input("MaNhanVienLog", sql.Int, maNguoiThaoTac)
            .input("HanhDong", sql.NVarChar, "UPDATE")
            .input("BangTacDong", sql.NVarChar, "NhanVien")
            .input("NoiDungMoi", sql.NVarChar, `Cập nhật thông tin chi tiết nhân viên: ${TenNhanVien.trim()} (Mã ID: ${id})`)
            .query(`
                INSERT INTO LichSuThaoTac(MaNhanVien, HanhDong, BangTacDong, NoiDungMoi)
                VALUES(@MaNhanVienLog, @HanhDong, @BangTacDong, @NoiDungMoi)
            `);

        await transaction.commit();
        return res.status(200).json({ success: true, message: "Cập nhật dữ liệu nhân viên và lưu nhật ký thành công!" });

    } catch (error) {
        if (transaction._begun) await transaction.rollback();
        console.error("Lỗi cập nhật nhân viên:", error);
        if (error.message.includes("Violation of UNIQUE KEY constraint")) {
            return res.status(400).json({ success: false, message: "Lỗi: Số CCCD hoặc Email này đã bị trùng lắp với một nhân viên khác!" });
        }
        return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

// =========================================================================
// 5. XÓA MỀM NHÂN VIÊN + GHI LỊCH SỬ THAO TÁC (Có Transaction)
// =========================================================================
const deleteNhanVien = async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        const { id } = req.params;
        await transaction.begin();

        // Bước A: Kiểm tra xem nhân viên tồn tại không và lấy tên phục vụ mục đích ghi Log chi tiết
        const infoResult = await new sql.Request(transaction)
            .input("MaNhanVien", sql.Int, id)
            .query(`SELECT TenNhanVien FROM NhanVien WHERE MaNhanVien = @MaNhanVien AND IsDeleted = 0`);

        if (infoResult.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên cần xóa hoặc đã bị xóa từ trước!" });
        }
        const targetEmployeeName = infoResult.recordset[0].TenNhanVien;

        // Bước B: Thực hiện cập nhật xóa mềm dữ liệu nhân viên (IsDeleted = 1)
        await new sql.Request(transaction)
            .input("MaNhanVien", sql.Int, id)
            .query(`
                UPDATE NhanVien
                SET IsDeleted = 1,
                    DeletedAt = GETDATE(),
                    TrangThai = 0
                WHERE MaNhanVien = @MaNhanVien
            `);

        // Bước C: Ghi nhận lịch sử thao tác xóa mềm
        const maNguoiThaoTac = req.user?.id || req.user?.maNhanVien || 1;

        await new sql.Request(transaction)
            .input("MaNhanVienLog", sql.Int, maNguoiThaoTac)
            .input("HanhDong", sql.NVarChar, "DELETE")
            .input("BangTacDong", sql.NVarChar, "NhanVien")
            .input("NoiDungMoi", sql.NVarChar, `Thực hiện xóa mềm nhân viên: ${targetEmployeeName} (Mã ID: ${id})`)
            .query(`
                INSERT INTO LichSuThaoTac(MaNhanVien, HanhDong, BangTacDong, NoiDungMoi)
                VALUES(@MaNhanVienLog, @HanhDong, @BangTacDong, @NoiDungMoi)
            `);

        await transaction.commit();
        return res.status(200).json({ success: true, message: "Xóa trạng thái hoạt động của nhân viên và lưu nhật ký thành công!" });

    } catch (error) {
        if (transaction._begun) await transaction.rollback();
        console.error("Lỗi xóa nhân viên:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

// Xuất các hàm ra ngoài để Router sử dụng
module.exports = {
    getAllNhanVien,
    getNhanVienById,
    createNhanVien,
    updateNhanVien,
    deleteNhanVien
};