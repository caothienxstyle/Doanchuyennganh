const { sql, poolPromise } = require("../db/data"); 
const writeLog = require("./logController"); 

// 1. LẤY DANH SÁCH TẤT CẢ ĐƠN VỊ TÍNH
const getAllDonViTinh = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT MaDonVi, TenDonVi, MoTa 
            FROM DonViTinh
            ORDER BY TenDonVi ASC
        `);
        
        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error("Lỗi lấy danh sách đơn vị tính:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 2. THÊM MỚI ĐƠN VỊ TÍNH (Đã thêm Log)
const createDonViTinh = async (req, res) => {
    try {
        const { TenDonVi, MoTa } = req.body;
        const MaNhanVien = req.user ? req.user.id : null; // Lấy ID nhân viên thực hiện

        if (!TenDonVi) {
            return res.status(400).json({ success: false, message: "Tên đơn vị tính không được để trống!" });
        }

        const pool = await poolPromise;

        // Kiểm tra xem tên đơn vị tính này đã tồn tại chưa
        const checkExist = await pool.request()
            .input("TenDonVi", sql.NVarChar, TenDonVi.trim())
            .query("SELECT MaDonVi FROM DonViTinh WHERE TenDonVi = @TenDonVi");

        if (checkExist.recordset.length > 0) {
            return res.status(400).json({ success: false, message: "Tên đơn vị tính này đã tồn tại!" });
        }

        // Tiến hành chèn mới
        await pool.request()
            .input("TenDonVi", sql.NVarChar, TenDonVi.trim())
            .input("MoTa", sql.NVarChar, MoTa || null)
            .query(`
                INSERT INTO DonViTinh (TenDonVi, MoTa) 
                VALUES (@TenDonVi, @MoTa)
            `);

        // 📝 Ghi log hệ thống
        try {
            if (MaNhanVien) {
                await writeLog(MaNhanVien, "Thêm mới", "DonViTinh", `Nhân viên tạo ĐVT mới: ${TenDonVi}`);
            }
        } catch (logError) {
            console.error("⚠️ Cảnh báo lỗi ghi log hệ thống:", logError.message);
        }

        return res.status(201).json({ success: true, message: "Thêm đơn vị tính thành công!" });
    } catch (error) {
        console.error("Lỗi thêm đơn vị tính:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 3. CẬP NHẬT (SỬA) ĐƠN VỊ TÍNH (Đã thêm Log)
const updateDonViTinh = async (req, res) => {
    try {
        const { id } = req.params; 
        const { TenDonVi, MoTa } = req.body;
        const MaNhanVien = req.user ? req.user.id : null;

        if (!TenDonVi) {
            return res.status(400).json({ success: false, message: "Tên đơn vị tính không được để trống!" });
        }

        const pool = await poolPromise;

        // Kiểm tra trùng tên
        const checkDuplicate = await pool.request()
            .input("MaDonVi", sql.Int, id)
            .input("TenDonVi", sql.NVarChar, TenDonVi.trim())
            .query("SELECT MaDonVi FROM DonViTinh WHERE TenDonVi = @TenDonVi AND MaDonVi <> @MaDonVi");

        if (checkDuplicate.recordset.length > 0) {
            return res.status(400).json({ success: false, message: "Tên đơn vị tính này đã bị trùng với dữ liệu khác!" });
        }

        // Cập nhật thông tin
        const result = await pool.request()
            .input("MaDonVi", sql.Int, id)
            .input("TenDonVi", sql.NVarChar, TenDonVi.trim())
            .input("MoTa", sql.NVarChar, MoTa || null)
            .query(`
                UPDATE DonViTinh 
                SET TenDonVi = @TenDonVi, MoTa = @MoTa 
                WHERE MaDonVi = @MaDonVi
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn vị tính để cập nhật!" });
        }

        // 📝 Ghi log hệ thống
        try {
            if (MaNhanVien) {
                await writeLog(MaNhanVien, "Cập nhật", "DonViTinh", `Nhân viên sửa ĐVT mang ID ${id} thành: ${TenDonVi}`);
            }
        } catch (logError) {
            console.error("⚠️ Cảnh báo lỗi ghi log hệ thống:", logError.message);
        }

        return res.status(200).json({ success: true, message: "Cập nhật đơn vị tính thành công!" });
    } catch (error) {
        console.error("Lỗi cập nhật đơn vị tính:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 4. XÓA ĐƠN VỊ TÍNH (Đã thêm Log)
const deleteDonViTinh = async (req, res) => {
    try {
        const { id } = req.params;
        const MaNhanVien = req.user ? req.user.id : null;
        const pool = await poolPromise;

        // Lấy tên đơn vị tính trước khi xóa để đưa vào nội dung log
        const getInfo = await pool.request()
            .input("MaDonVi", sql.Int, id)
            .query("SELECT TenDonVi FROM DonViTinh WHERE MaDonVi = @MaDonVi");

        if (getInfo.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn vị tính để xóa!" });
        }
        const tenDVTxoa = getInfo.recordset[0].TenDonVi;

        // Kiểm tra xem đơn vị tính này đã được gán cho sản phẩm nào chưa
        const checkInProduct = await pool.request()
            .input("MaDonVi", sql.Int, id)
            .query("SELECT TOP 1 MaSanPham FROM SanPham WHERE MaDonVi = @MaDonVi"); 

        if (checkInProduct.recordset.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Không thể xóa đơn vị tính này vì đang có sản phẩm sử dụng nó!" 
            });
        }

        // Thực hiện xóa
        await pool.request()
            .input("MaDonVi", sql.Int, id)
            .query("DELETE FROM DonViTinh WHERE MaDonVi = @MaDonVi");

        // 📝 Ghi log hệ thống
        try {
            if (MaNhanVien) {
                await writeLog(MaNhanVien, "Xóa", "DonViTinh", `Nhân viên xóa ĐVT: ${tenDVTxoa} (ID: ${id})`);
            }
        } catch (logError) {
            console.error("⚠️ Cảnh báo lỗi ghi log hệ thống:", logError.message);
        }

        return res.status(200).json({ success: true, message: "Xóa đơn vị tính thành công!" });
    } catch (error) {
        console.error("Lỗi xóa đơn vị tính:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllDonViTinh,
    createDonViTinh,
    updateDonViTinh,
    deleteDonViTinh
};