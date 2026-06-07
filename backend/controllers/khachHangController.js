
const { sql, poolPromise } = require('../db/data'); // Thay đổi đường dẫn db cho đúng với dự án của bạn

// 1. LẤY DANH SÁCH KHÁCH HÀNG (Chỉ lấy các khách hàng chưa bị xóa)
const getAllKhachHang = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`SELECT MaKH, MaKHCode, TenKH, SDT, Email, DiaChi, CreatedAt 
                    FROM KhachHang 
                    WHERE IsDeleted = 0 
                    ORDER BY MaKH DESC`);
        
        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error("Lỗi lấy danh sách khách hàng:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

// 2. XEM CHI TIẾT MỘT KHÁCH HÀNG
const getKhachHangById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('MaKH', sql.Int, id)
            .query(`SELECT MaKH, MaKHCode, TenKH, SDT, Email, DiaChi, CreatedAt 
                    FROM KhachHang 
                    WHERE MaKH = @MaKH AND IsDeleted = 0`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng hoặc đã bị xóa!" });
        }

        return res.status(200).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        console.error("Lỗi lấy chi tiết khách hàng:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

// 3. THÊM MỚI KHÁCH HÀNG
const createKhachHang = async (req, res) => {
    try {
        const { MaKHCode, TenKH, SDT, Email, DiaChi } = req.body;

        if (!TenKH) {
            return res.status(400).json({ success: false, message: "Tên khách hàng không được để trống!" });
        }

        const pool = await poolPromise;

        // Tự động sinh mã KHCode nếu frontend không gửi (Ví dụ: KH123456)
        const finalKHCode = MaKHCode || "KH" + Math.floor(100000 + Math.random() * 900000);

        // Kiểm tra xem mã code có bị trùng không
        const checkCode = await pool.request()
            .input('Code', sql.VarChar, finalKHCode)
            .query('SELECT MaKH FROM KhachHang WHERE MaKHCode = @Code');
        
        if (checkCode.recordset.length > 0) {
            return res.status(400).json({ success: false, message: "Mã khách hàng này đã tồn tại trong hệ thống!" });
        }

        // Tiến hành chèn dữ liệu
        await pool.request()
            .input('MaKHCode', sql.VarChar, finalKHCode)
            .input('TenKH', sql.NVarChar, TenKH)
            .input('SDT', sql.VarChar, SDT || null)
            .input('Email', sql.VarChar, Email || null)
            .input('DiaChi', sql.NVarChar, DiaChi || null)
            .query(`INSERT INTO KhachHang (MaKHCode, TenKH, SDT, Email, DiaChi) 
                    VALUES (@MaKHCode, @TenKH, @SDT, @Email, @DiaChi)`);

        return res.status(201).json({ success: true, message: "Thêm mới khách hàng thành công!", code: finalKHCode });
    } catch (error) {
        console.error("Lỗi thêm khách hàng:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

// 4. CẬP NHẬT THÔNG TIN KHÁCH HÀNG
const updateKhachHang = async (req, res) => {
    try {
        const { id } = req.params;
        const { TenKH, SDT, Email, DiaChi } = req.body;

        if (!TenKH) {
            return res.status(400).json({ success: false, message: "Tên khách hàng không được để trống!" });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('MaKH', sql.Int, id)
            .input('TenKH', sql.NVarChar, TenKH)
            .input('SDT', sql.VarChar, SDT || null)
            .input('Email', sql.VarChar, Email || null)
            .input('DiaChi', sql.NVarChar, DiaChi || null)
            .query(`UPDATE KhachHang 
                    SET TenKH = @TenKH, SDT = @SDT, Email = @Email, DiaChi = @DiaChi 
                    WHERE MaKH = @MaKH AND IsDeleted = 0`);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng để cập nhật!" });
        }

        return res.status(200).json({ success: true, message: "Cập nhật thông tin khách hàng thành công!" });
    } catch (error) {
        console.error("Lỗi cập nhật khách hàng:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

// 5. XÓA MỀM KHÁCH HÀNG (Đổi trạng thái IsDeleted = 1 chứ không xóa hẳn khỏi DB để an toàn dữ liệu)
const deleteKhachHang = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;

        const result = await pool.request()
            .input('MaKH', sql.Int, id)
            .query(`UPDATE KhachHang SET IsDeleted = 1 WHERE MaKH = @MaKH`);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng hoặc đã bị xóa trước đó!" });
        }

        return res.status(200).json({ success: true, message: "Xóa khách hàng thành công!" });
    } catch (error) {
        console.error("Lỗi xóa khách hàng:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

module.exports = {
    getAllKhachHang,
    getKhachHangById,
    createKhachHang,
    updateKhachHang,
    deleteKhachHang
};