const { sql, poolPromise } = require("../db/data");
const { writeLog } = require("./logController");

// 1. LẤY DANH SÁCH PHIẾU NHẬP
const getAllPhieuNhap = async (req, res) => {
    try {
        const pool = await poolPromise;
        
        const result = await pool.request().query(`
            SELECT MaPhieuNhap, MaPhieu, NgayNhap, MaNCC, MaKho, MaNhanVien, TongTien, TrangThai, GhiChu 
            FROM PhieuNhap 
            ORDER BY NgayNhap DESC
        `);
        
        res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error("Lỗi khi lấy danh sách phiếu nhập:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. TẠO MỚI PHIẾU NHẬP
const createPhieuNhap = async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        const { MaPhieu, MaNhaCungCap, MaKho, TongTien, GhiChu, ChiTiet } = req.body;
        const MaNhanVien = req.user.id; 

        if (!ChiTiet || ChiTiet.length === 0) {
            return res.status(400).json({ success: false, message: "Phiếu nhập phải có ít nhất 1 sản phẩm!" });
        }

        await transaction.begin();

        // Chèn vào bảng chính PhieuNhap
        const phieuNhapResult = await new sql.Request(transaction)
            .input("MaPhieu", sql.VarChar, MaPhieu)
            .input("MaNCC", sql.Int, MaNhaCungCap) 
            .input("MaKho", sql.Int, MaKho)
            .input("MaNhanVien", sql.Int, MaNhanVien)
            .input("TongTien", sql.Decimal, TongTien)
            .input("GhiChu", sql.NVarChar, GhiChu)
            .query(`
                INSERT INTO PhieuNhap (MaPhieu, MaNCC, MaKho, MaNhanVien, TongTien, TrangThai, GhiChu, NgayNhap)
                OUTPUT INSERTED.MaPhieuNhap
                VALUES (@MaPhieu, @MaNCC, @MaKho, @MaNhanVien, @TongTien, N'ChoDuyet', @GhiChu, GETDATE())
            `);

        const MaPhieuNhapVuaTao = phieuNhapResult.recordset[0].MaPhieuNhap;

        // Vòng lặp chèn chi tiết sản phẩm
        for (const item of ChiTiet) {
            
            // 🛠️ BƯỚC SỬA ĐỔI: Tìm ID MaViTri thực tế từ MaViTriCode ("VT001") nằm TRONG transaction
            const viTriResult = await new sql.Request(transaction)
                .input("MaKho", sql.Int, parseInt(MaKho))
                .input("MaViTriCode", sql.VarChar, String(item.MaViTriCode).trim())
                .query(`
                    SELECT MaViTri 
                    FROM ViTriKho 
                    WHERE MaKho = @MaKho AND MaViTriCode = @MaViTriCode
                `);

            if (viTriResult.recordset.length === 0) {
                throw new Error(`Không tìm thấy mã vị trí "${item.MaViTriCode}" thuộc Kho mang ID ${MaKho}`);
            }

            const MaViTriThucTe = viTriResult.recordset[0].MaViTri;

            // Tiến hành chèn vào ChiTietPhieuNhap với đầy đủ Ngày Sản Xuất và Hạn Sử Dụng
            await new sql.Request(transaction)
                .input("MaPhieuNhap", sql.Int, MaPhieuNhapVuaTao)
                .input("MaSanPham", sql.Int, item.MaSP)
                .input("SoLuong", sql.Int, item.SoLuong)
                .input("DonGia", sql.Decimal, item.DonGia)
                .input("MaViTri", sql.Int, MaViTriThucTe) 
                // Thêm input xử lý Date (Nếu Frontend truyền rỗng hoặc không truyền thì tự động lưu NULL)
                .input("NgaySanXuat", sql.Date, item.NgaySanXuat ? new Date(item.NgaySanXuat) : null)
                .input("HanSuDung", sql.Date, item.HanSuDung ? new Date(item.HanSuDung) : null) // Khớp 100% với tên cột HanSuDung trong DB
                .query(`
                    INSERT INTO ChiTietPhieuNhap (MaPhieuNhap, MaSanPham, SoLuong, DonGia, MaViTri, NgaySanXuat, HanSuDung)
                    VALUES (@MaPhieuNhap, @MaSanPham, @SoLuong, @DonGia, @MaViTri, @NgaySanXuat, @HanSuDung)
                `);
        }

        try {
            await writeLog(MaNhanVien, "Thêm mới", "PhieuNhap", `Nhân viên tạo phiếu mới: ${MaPhieu}`);
        } catch (logError) {
            console.error("⚠️ Cảnh báo lỗi ghi log hệ thống:", logError.message);
        }

        await transaction.commit();

        return res.status(201).json({ 
            success: true, 
            message: "Tạo phiếu nhập và danh sách chi tiết thành công!", 
            maPhieuNhap: MaPhieuNhapVuaTao 
        });

    } catch (error) {
        try {
            if (transaction && transaction._begun) {
                await transaction.rollback();
                console.log("🔄 Đã tự động Rollback Transaction giải phóng bộ nhớ!");
            }
        } catch (rollbackError) {
            console.error("Lỗi khi hủy transaction:", rollbackError);
        }
        console.error("Lỗi khi tạo phiếu nhập:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const approvePhieuNhap = async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        const { MaPhieu } = req.body; // Đây là mã dạng chuỗi (Ví dụ: PN199408) hoặc ID tùy FE truyền lên
        const NguoiDuyet = req.user?.id || req.user?.MaNhanVien || 1; 

        if (!MaPhieu) {
            return res.status(400).json({ success: false, message: "Vui lòng cung cấp MaPhieu nhập cần duyệt!" });
        }

        await transaction.begin();

        // 1. Kiểm tra sự tồn tại và lấy thông tin tổng quan của Phiếu Nhập (Khóa hàng UPDLOCK để chống tranh chấp)
        const phieuQuery = await new sql.Request(transaction)
            .input("MaPhieu", sql.VarChar, MaPhieu)
            .query(`
                SELECT MaPhieuNhap, MaKho, TrangThai 
                FROM PhieuNhap WITH (UPDLOCK) 
                WHERE MaPhieu = @MaPhieu OR CAST(MaPhieuNhap AS VARCHAR) = @MaPhieu
            `);

        if (phieuQuery.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập này trong hệ thống!" });
        }

        const phieuInfo = phieuQuery.recordset[0];
        const idPhieuNhap = phieuInfo.MaPhieuNhap;
        const idKho = phieuInfo.MaKho;

        if (phieuInfo.TrangThai !== "ChoDuyet") {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: "Phiếu nhập này đã được duyệt hoặc xử lý trước đó rồi!" });
        }

        // 2. Lấy danh sách sản phẩm chi tiết trong phiếu nhập để chuẩn bị cộng vào kho
        const chiTietQuery = await new sql.Request(transaction)
            .input("MaPhieuNhap", sql.Int, idPhieuNhap)
            .query(`SELECT MaSanPham, SoLuong, MaViTri FROM ChiTietPhieuNhap WHERE MaPhieuNhap = @MaPhieuNhap`);

        if (chiTietQuery.recordset.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: "Phiếu nhập không có chi tiết mặt hàng, không thể duyệt!" });
        }

        // 3. Vòng lặp xử lý Tăng Tồn Kho cho từng sản phẩm tại từng vị trí cụ thể
        for (const item of chiTietQuery.recordset) {
            const maSP = item.MaSanPham;
            const soLuongNhap = item.SoLuong;
            const maViTri = item.MaViTri;

            // Kiểm tra xem vị trí kho này + sản phẩm này đã từng có dòng tồn kho nào chưa
            const checkTonKho = await new sql.Request(transaction)
                .input("MaKho", sql.Int, idKho)
                .input("MaSanPham", sql.Int, maSP)
                .input("MaViTri", sql.Int, maViTri)
                .query(`
                    SELECT 1 FROM TonKho 
                    WHERE MaKho = @MaKho AND MaSanPham = @MaSanPham AND MaViTri = @MaViTri
                `);

            if (checkTonKho.recordset.length > 0) {
                // Trường hợp 1: Đã tồn tại dòng mặt hàng này -> CỘNG THÊM số lượng
                await new sql.Request(transaction)
                    .input("MaKho", sql.Int, idKho)
                    .input("MaSanPham", sql.Int, maSP)
                    .input("MaViTri", sql.Int, maViTri)
                    .input("SoLuongNhap", sql.Int, soLuongNhap)
                    .query(`
                        UPDATE TonKho
                        SET SoLuongTon = SoLuongTon + @SoLuongNhap,
                            NgayCapNhat = GETDATE()
                        WHERE MaKho = @MaKho AND MaSanPham = @MaSanPham AND MaViTri = @MaViTri
                    `);
            } else {
                // Trường hợp 2: Mặt hàng chưa từng có ở vị trí này -> INSERT dòng mới
                await new sql.Request(transaction)
                    .input("MaKho", sql.Int, idKho)
                    .input("MaSanPham", sql.Int, maSP)
                    .input("MaViTri", sql.Int, maViTri)
                    .input("SoLuongNhap", sql.Int, soLuongNhap)
                    .query(`
                        INSERT INTO TonKho (MaKho, MaSanPham, MaViTri, SoLuongTon, NgayCapNhat)
                        VALUES (@MaKho, @MaSanPham, @MaViTri, @SoLuongNhap, GETDATE())
                    `);
            }
        }

        // 4. Cập nhật trạng thái phiếu nhập thành 'DaDuyet' sau khi đã cộng kho thành công
        await new sql.Request(transaction)
            .input("MaPhieuNhap", sql.Int, idPhieuNhap)
            .input("NguoiDuyet", sql.Int, NguoiDuyet)
            .query(`
                UPDATE PhieuNhap 
                SET TrangThai = N'DaDuyet', 
                    NguoiDuyet = @NguoiDuyet, 
                    NgayDuyet = GETDATE()
                WHERE MaPhieuNhap = @MaPhieuNhap
            `);

        // 5. Ghi log lịch sử thao tác
        try {
            await writeLog(NguoiDuyet, "DUYET_PHIEU", "PhieuNhap", `Đã duyệt thành công và cộng tồn kho cho phiếu nhập số: ${MaPhieu}`);
        } catch (logError) {
            console.error("⚠️ Cảnh báo lỗi ghi log hệ thống:", logError.message);
        }

        // Cam kết hoàn tất mọi tiến trình
        await transaction.commit();

        return res.status(200).json({ 
            success: true, 
            message: `Duyệt phiếu nhập số ${MaPhieu} và cập nhật tăng số lượng tồn kho thành công!` 
        });

    } catch (error) {
        try {
            if (transaction && transaction._begun) {
                await transaction.rollback();
                console.log("🔄 Đã tự động hồi tán (Rollback) dữ liệu Phiếu Nhập để tránh lỗi lệch kho!");
            }
        } catch (rollbackError) {
            console.error("Lỗi khi hủy transaction phiếu nhập:", rollbackError);
        }
        console.error("Lỗi xử lý tại hàm duyệt phiếu nhập:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 4. CẬP NHẬT PHIẾU NHẬP (Chỉ sửa khi trạng thái là 'ChoDuyet')
const updatePhieuNhap = async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        const { MaPhieuNhap, MaPhieu, MaNhaCungCap, MaKho, TongTien, GhiChu, ChiTiet } = req.body;
        const MaNhanVienSua = req.user.id; 

        if (!MaPhieuNhap) {
            return res.status(400).json({ success: false, message: "Vui lòng cung cấp MaPhieuNhap cần sửa!" });
        }

        if (!ChiTiet || ChiTiet.length === 0) {
            return res.status(400).json({ success: false, message: "Phiếu nhập phải có ít nhất 1 sản phẩm!" });
        }

        await transaction.begin();

        // Kiểm tra điều kiện: Phiếu tồn tại và trạng thái phải là 'ChoDuyet'
        const checkResult = await new sql.Request(transaction)
            .input("MaPhieuNhap", sql.Int, MaPhieuNhap)
            .query(`SELECT TrangThai FROM PhieuNhap WHERE MaPhieuNhap = @MaPhieuNhap`);

        if (checkResult.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập này trong hệ thống!" });
        }

        if (checkResult.recordset[0].TrangThai !== "ChoDuyet") {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: "Phiếu đã được duyệt hoặc hoàn thành, không thể sửa đổi!" });
        }

        // Cập nhật thông tin bảng chính PhieuNhap
        await new sql.Request(transaction)
            .input("MaPhieuNhap", sql.Int, MaPhieuNhap)
            .input("MaPhieu", sql.VarChar, MaPhieu)
            .input("MaNCC", sql.Int, MaNhaCungCap)
            .input("MaKho", sql.Int, MaKho)
            .input("TongTien", sql.Decimal, TongTien)
            .input("GhiChu", sql.NVarChar, GhiChu)
            .query(`
                UPDATE PhieuNhap
                SET MaPhieu = @MaPhieu,
                    MaNCC = @MaNCC,
                    MaKho = @MaKho,
                    TongTien = @TongTien,
                    GhiChu = @GhiChu
                WHERE MaPhieuNhap = @MaPhieuNhap
            `);

        // Xóa các chi tiết cũ
        await new sql.Request(transaction)
            .input("MaPhieuNhap", sql.Int, MaPhieuNhap)
            .query(`DELETE FROM ChiTietPhieuNhap WHERE MaPhieuNhap = @MaPhieuNhap`);

        // Chèn lại danh sách chi tiết mới
        for (const item of ChiTiet) {
            await new sql.Request(transaction)
                .input("MaPhieuNhap", sql.Int, MaPhieuNhap)
                .input("MaSanPham", sql.Int, item.MaSP)
                .input("SoLuong", sql.Int, item.SoLuong)
                .input("DonGia", sql.Decimal, item.DonGia)
                .input("MaViTri", sql.Int, item.MaViTri)
                .query(`
                    INSERT INTO ChiTietPhieuNhap (MaPhieuNhap, MaSanPham, SoLuong, DonGia, MaViTri)
                    VALUES (@MaPhieuNhap, @MaSanPham, @SoLuong, @DonGia, @MaViTri)
                `);
        }

        try {
            await writeLog(MaNhanVienSua, "Cập nhật", "PhieuNhap", `Nhân viên sửa phiếu nhập ID: ${MaPhieuNhap} - Số phiếu: ${MaPhieu}`);
        } catch (logError) {
            console.error("⚠️ Cảnh báo lỗi ghi log hệ thống:", logError.message);
        }

        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: "Cập nhật phiếu nhập và danh sách chi tiết thành công!"
        });

    } catch (error) {
        try {
            if (transaction && transaction._begun) {
                await transaction.rollback();
                console.log("🔄 Đã rollback Transaction cập nhật phiếu nhập!");
            }
        } catch (rollbackError) {
            console.error("Lỗi khi hủy transaction:", rollbackError);
        }
        console.error("Lỗi khi cập nhật phiếu nhập:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getChiTietPhieuNhap = async (req, res) => {
    try {
        const { id } = req.params; 
        const pool = await poolPromise;
        
        const result = await pool.request()
            .input("MaPhieuNhap", sql.Int, id)
            .query(`
                SELECT 
                    ct.MaCTPN,
                    ct.MaPhieuNhap,
                    ct.MaSanPham,
                    ISNULL(sp.TenSanPham, N'Sản phẩm mã #' + CAST(ct.MaSanPham AS NVARCHAR(10))) AS TenSanPham,
                    ct.SoLuong,
                    ct.DonGia,
                    ct.ThanhTien,
                    ct.MaViTri,
                    ct.NgaySanXuat,
                    ct.HanSuDung,             -- 🌟 Đã thêm dấu phẩy ở đây
                    vt.KhuVuc,               -- 🌟 Lấy từ bảng vt (ViTri) thông qua MaViTri
                    vt.DayKe,
                    vt.Tang,
                    vt.OKe
                FROM ChiTietPhieuNhap ct
                LEFT JOIN SanPham sp ON ct.MaSanPham = sp.MaSanPham
                LEFT JOIN ViTriKho vt ON ct.MaViTri = vt.MaViTri -- 🌟 JOIN sang bảng Vị Trí
                WHERE ct.MaPhieuNhap = @MaPhieuNhap
            `);
            
        res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error("Lỗi lấy chi tiết phiếu nhập:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllPhieuNhap,
    createPhieuNhap,
    approvePhieuNhap,
    updatePhieuNhap,
    getChiTietPhieuNhap
};
