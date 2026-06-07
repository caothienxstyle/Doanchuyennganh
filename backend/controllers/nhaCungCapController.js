const { sql, poolPromise } = require("../db/data");
const { writeLog } = require("./logController");

// 1. LẤY DANH SÁCH NHÀ CUNG CẤP (Chỉ lấy các nhà cung cấp chưa bị xóa)
const getAllNhaCungCap = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT MaNCC, MaNCCCode, TenNCC, NguoiLienHe, SDT, Email, DiaChi, CreatedAt
            FROM NhaCungCap
            WHERE IsDeleted = 0
            ORDER BY CreatedAt DESC
        `);

        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error("Lỗi khi lấy danh sách nhà cung cấp:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 2. XEM CHI TIẾT MỘT NHÀ CUNG CẤP
const getDetailNhaCungCap = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;

        const result = await pool.request()
            .input("MaNCC", sql.Int, id)
            .query(`
                SELECT MaNCC, MaNCCCode, TenNCC, NguoiLienHe, SDT, Email, DiaChi, CreatedAt, IsDeleted
                FROM NhaCungCap
                WHERE MaNCC = @MaNCC
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy nhà cung cấp này!" });
        }

        return res.status(200).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        console.error("Lỗi khi lấy chi tiết nhà cung cấp:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 3. TẠO MỚI NHÀ CUNG CẤP
const createNhaCungCap = async (req, res) => {
    try {
        const { MaNCCCode, TenNCC, NguoiLienHe, SDT, Email, DiaChi } = req.body;
        const MaNhanVienThucHien = req.user?.id || req.user?.MaNhanVien || 1;

        if (!TenNCC || TenNCC.trim() === "") {
            return res.status(400).json({ success: false, message: "Tên nhà cung cấp không được để trống!" });
        }

        // Tự động sinh mã NCC nếu Frontend không truyền lên (ví dụ: NCC171683402)
        const customCode = MaNCCCode && MaNCCCode.trim() !== "" 
            ? MaNCCCode.trim() 
            : `NCC${Math.floor(Date.now() / 1000)}`;

        const pool = await poolPromise;

        // Kiểm tra xem mã Code này có bị trùng lặp trong hệ thống không
        const checkCode = await pool.request()
            .input("MaNCCCode", sql.VarChar, customCode)
            .query(`SELECT 1 FROM NhaCungCap WHERE MaNCCCode = @MaNCCCode`);

        if (checkCode.recordset.length > 0) {
            return res.status(400).json({ success: false, message: `Mã nhà cung cấp '${customCode}' đã tồn tại!` });
        }

        // Thực hiện chèn vào cơ sở dữ liệu
        const result = await pool.request()
            .input("MaNCCCode", sql.VarChar, customCode)
            .input("TenNCC", sql.NVarChar, TenNCC.trim())
            .input("NguoiLienHe", sql.NVarChar, NguoiLienHe || null)
            .input("SDT", sql.VarChar, SDT || null)
            .input("Email", sql.VarChar, Email || null)
            .input("DiaChi", sql.NVarChar, DiaChi || null)
            .query(`
                INSERT INTO NhaCungCap (MaNCCCode, TenNCC, NguoiLienHe, SDT, Email, DiaChi, IsDeleted, CreatedAt)
                OUTPUT INSERTED.MaNCC
                VALUES (@MaNCCCode, @TenNCC, @NguoiLienHe, @SDT, @Email, @DiaChi, 0, GETDATE())
            `);

        const newId = result.recordset[0].MaNCC;

        // Ghi log lịch sử hệ thống
        try {
            await writeLog(MaNhanVienThucHien, "Thêm mới", "NhaCungCap", `Tạo nhà cung cấp mới: ${TenNCC} (${customCode})`);
        } catch (logError) {
            console.error("⚠️ Lỗi ghi log:", logError.message);
        }

        return res.status(201).json({
            success: true,
            message: "Tạo mới nhà cung cấp thành công!",
            data: { MaNCC: newId, MaNCCCode: customCode }
        });

    } catch (error) {
        console.error("Lỗi khi tạo nhà cung cấp:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 4. CẬP NHẬT THÔNG TIN NHÀ CUNG CẤP
const updateNhaCungCap = async (req, res) => {
    try {
        const { MaNCC, MaNCCCode, TenNCC, NguoiLienHe, SDT, Email, DiaChi } = req.body;
        const MaNhanVienThucHien = req.user?.id || req.user?.MaNhanVien || 1;

        if (!MaNCC) {
            return res.status(400).json({ success: false, message: "Vui lòng cung cấp ID Nhà cung cấp (MaNCC) cần sửa!" });
        }

        if (!TenNCC || TenNCC.trim() === "") {
            return res.status(400).json({ success: false, message: "Tên nhà cung cấp không được để trống!" });
        }

        const pool = await poolPromise;

        // Kiểm tra sự tồn tại của NCC
        const checkExist = await pool.request()
            .input("MaNCC", sql.Int, MaNCC)
            .query(`SELECT MaNCCCode FROM NhaCungCap WHERE MaNCC = @MaNCC`);

        if (checkExist.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy nhà cung cấp cần cập nhật!" });
        }

        // Nếu có thay đổi MaNCCCode, kiểm tra xem có bị trùng với người khác không
        if (MaNCCCode) {
            const checkCode = await pool.request()
                .input("MaNCC", sql.Int, MaNCC)
                .input("MaNCCCode", sql.VarChar, MaNCCCode.trim())
                .query(`SELECT 1 FROM NhaCungCap WHERE MaNCCCode = @MaNCCCode AND MaNCC != @MaNCC`);

            if (checkCode.recordset.length > 0) {
                return res.status(400).json({ success: false, message: `Mã nhà cung cấp '${MaNCCCode}' đã được sử dụng bởi hệ thống khác!` });
            }
        }

        // Tiến hành cập nhật dữ liệu
        await pool.request()
            .input("MaNCC", sql.Int, MaNCC)
            .input("MaNCCCode", sql.VarChar, MaNCCCode ? MaNCCCode.trim() : checkExist.recordset[0].MaNCCCode)
            .input("TenNCC", sql.NVarChar, TenNCC.trim())
            .input("NguoiLienHe", sql.NVarChar, NguoiLienHe || null)
            .input("SDT", sql.VarChar, SDT || null)
            .input("Email", sql.VarChar, Email || null)
            .input("DiaChi", sql.NVarChar, DiaChi || null)
            .query(`
                UPDATE NhaCungCap
                SET MaNCCCode = @MaNCCCode,
                    TenNCC = @TenNCC,
                    NguoiLienHe = @NguoiLienHe,
                    SDT = @SDT,
                    Email = @Email,
                    DiaChi = @DiaChi
                WHERE MaNCC = @MaNCC
            `);

        try {
            await writeLog(MaNhanVienThucHien, "Cập nhật", "NhaCungCap", `Cập nhật thông tin nhà cung cấp ID: ${MaNCC}`);
        } catch (logError) {
            console.error("⚠️ Lỗi ghi log:", logError.message);
        }

        return res.status(200).json({ success: true, message: "Cập nhật thông tin nhà cung cấp thành công!" });

    } catch (error) {
        console.error("Lỗi khi cập nhật nhà cung cấp:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 5. XÓA MỀM NHÀ CUNG CẤP (Soft Delete - Không làm mất dữ liệu hóa đơn/phiếu nhập cũ)
const deleteNhaCungCap = async (req, res) => {
    try {
        const { id } = req.params;
        const MaNhanVienThucHien = req.user?.id || req.user?.MaNhanVien || 1;

        const pool = await poolPromise;

        // Kiểm tra xem NCC có tồn tại không
        const checkExist = await pool.request()
            .input("MaNCC", sql.Int, id)
            .query(`SELECT TenNCC FROM NhaCungCap WHERE MaNCC = @MaNCC AND IsDeleted = 0`);

        if (checkExist.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Nhà cung cấp không tồn tại hoặc đã bị xóa trước đó!" });
        }

        // Chuyển trạng thái IsDeleted = 1 thay vì xóa cứng dòng
        await pool.request()
            .input("MaNCC", sql.Int, id)
            .query(`UPDATE NhaCungCap SET IsDeleted = 1 WHERE MaNCC = @MaNCC`);

        try {
            await writeLog(MaNhanVienThucHien, "Xóa", "NhaCungCap", `Đã xóa nhà cung cấp: ${checkExist.recordset[0].TenNCC} (ID: ${id})`);
        } catch (logError) {
            console.error("⚠️ Lỗi ghi log:", logError.message);
        }

        return res.status(200).json({ success: true, message: "Xóa nhà cung cấp thành công!" });

    } catch (error) {
        console.error("Lỗi khi xóa nhà cung cấp:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllNhaCungCap,
    getDetailNhaCungCap,
    createNhaCungCap,
    updateNhaCungCap,
    deleteNhaCungCap
};