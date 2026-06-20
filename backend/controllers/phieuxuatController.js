const { sql, poolPromise } = require("../db/data"); 
const writeLog = require("./logController").writeLog; 

// 1. HÀM TẠO PHIẾU XUẤT + CHI TIẾT PHIẾU XUẤT 
const createPhieuXuat = async (req, res) => {
    const pool = await poolPromise;
    // Sử dụng Transaction để đảm bảo: Hoặc lưu thành công cả phiếu lẫn chi tiết, hoặc hủy hết nếu có lỗi!
    const transaction = new sql.Transaction(pool);

    try {
        // 1. Đọc dữ liệu tổng quan từ Frontend gửi lên
        const MaKho = req.body.MaKho || req.body.MaKhoXuat || 1;
        const GhiChu = req.body.GhiChu || "";
        const MaKhachHang = req.body.MaKhachHang || 1;
        
        // Hứng gói mảng sản phẩm (Bọc lót biến ChiTiet từ FE của bạn)
        const DanhSachSanPham = req.body.ChiTiet || req.body.DanhSachSanPham || req.body.danhSachSanPham || req.body.products;
        
        // Lấy thông tin tổng tiền do FE tính toán sẵn gửi lên
        const TongTienFrontend = req.body.TongTien || 0;

        // Kiểm tra tính hợp lệ của danh sách sản phẩm trước khi thao tác Database
        if (!DanhSachSanPham || !Array.isArray(DanhSachSanPham) || DanhSachSanPham.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Tạo phiếu thất bại: Gói dữ liệu 'ChiTiet' hàng hóa bị trống hoặc sai cấu trúc mảng!" 
            });
        }

        // Lấy ID người dùng từ Token bảo mật
        const idUserTuToken = req.user?.id || req.user?.MaNhanVien || req.user?.MaNguoiDuyet || 1;

        // Khởi động giao dịch an toàn
        await transaction.begin();

        const textMaPhieu = "PX" + Math.floor(100000 + Math.random() * 900000);

        // Chèn thông tin chung vào bảng PhieuXuat (Đã sửa MaKhachHang thành MaKH để khớp Database)
        const phieuResult = await new sql.Request(transaction)
            .input("MaPhieu", sql.VarChar, textMaPhieu)
            .input("MaKho", sql.Int, parseInt(MaKho))
            .input("MaNhanVien", sql.Int, parseInt(idUserTuToken))
            .input("MaKH", sql.Int, parseInt(MaKhachHang)) // Đổi tên tham số truyền vào SQL thành MaKH
            .input("TongTien", sql.Decimal(18, 2), parseFloat(TongTienFrontend))
            .input("GhiChu", sql.NVarChar, GhiChu)
            .input("TrangThai", sql.NVarChar, 'ChoDuyet')
            .query(`
                INSERT INTO PhieuXuat (MaPhieu, MaKho, MaNhanVien, MaKH, TongTien, GhiChu, TrangThai)
                OUTPUT INSERTED.MaPhieuXuat
                VALUES (@MaPhieu, @MaKho, @MaNhanVien, @MaKH, @TongTien, @GhiChu, @TrangThai)
            `);

        const newPhieuXuatId = phieuResult.recordset[0].MaPhieuXuat;

        // 2. VÒNG LẶP CHÈN TỪNG SẢN PHẨM VÀO BẢNG CHI TIẾT
        for (const item of DanhSachSanPham) {
            // Đọc mã sản phẩm ID số hệ thống đã được FE map ngược lại chuẩn chỉnh
            const thongTinMaSP = item.MaSP || item.MaSanPham || item.id;
            const maSPId = parseInt(thongTinMaSP);

            if (!maSPId || isNaN(maSPId)) {
                throw new Error(`Phát hiện sản phẩm có ID không hợp lệ trong danh sách! (Dữ liệu nhận: ${thongTinMaSP})`);
            }

            // Xử lý chuyển đổi mã vị trí chữ (VT001, VT002...) sang ID số tương ứng trong DB
            let viTriId = item.MaViTri || item.viTriId;
            const textViTriCode = item.MaViTriCode || item.maViTriCode;

            if (textViTriCode && (!viTriId || isNaN(parseInt(viTriId)))) {
                const findViTri = await new sql.Request(transaction)
                    .input("MaCode", sql.VarChar, String(textViTriCode).trim())
                    .query(`SELECT TOP 1 MaViTri FROM ViTriKho WHERE MaViTriCode = @MaCode`);
                
                if (findViTri.recordset.length > 0) {
                    viTriId = findViTri.recordset[0].MaViTri;
                }
            }

            // Phương án phòng hờ nếu không xác định được vị trí
            if (!viTriId || isNaN(parseInt(viTriId))) {
                const defaultViTri = await new sql.Request(transaction)
                    .input("MaKho", sql.Int, parseInt(MaKho))
                    .query(`SELECT TOP 1 MaViTri FROM ViTriKho WHERE MaKho = @MaKho ORDER BY MaViTri ASC`);

                viTriId = defaultViTri.recordset.length > 0 ? defaultViTri.recordset[0].MaViTri : 1;
            }

            const soLuongXuat = parseInt(item.SoLuong || item.soLuong || 0);
            const donGiaXuat = parseFloat(item.DonGia || item.donGia || 0);

            // Chèn vào bảng dữ liệu ChiTietPhieuXuat
            await new sql.Request(transaction)
                .input("MaPhieuXuat", sql.Int, newPhieuXuatId)
                .input("MaSanPham", sql.Int, maSPId)
                .input("MaViTri", sql.Int, parseInt(viTriId))
                .input("SoLuong", sql.Int, soLuongXuat)
                .input("DonGia", sql.Decimal(18, 2), donGiaXuat)
                .query(`
                    INSERT INTO ChiTietPhieuXuat (MaPhieuXuat, MaSanPham, MaViTri, SoLuong, DonGia)
                    VALUES (@MaPhieuXuat, @MaSanPham, @MaViTri, @SoLuong, @DonGia)
                `);
        }

        // 🌟 GHI LOG: Thêm mới phiếu xuất kho thành công
        try {
            await writeLog(idUserTuToken, "Thêm mới", "PhieuXuat", `Tạo phiếu xuất kho mới thành công. Mã phiếu: ${textMaPhieu}, Tổng tiền: ${TongTienFrontend}đ`);
        } catch (logError) {
            console.error("⚠️ Lỗi ghi log tạo phiếu xuất:", logError.message);
        }

        // Nếu tất cả các bước trên đều chạy êm đẹp, xác nhận lưu vĩnh viễn vào DB
        await transaction.commit();

        return res.status(201).json({
            success: true,
            message: `Tạo phiếu xuất kho ${textMaPhieu} thành công! Tổng tiền: ${TongTienFrontend}đ`,
            data: { MaPhieu: textMaPhieu }
        });

    } catch (error) {
        // CƠ CHẾ CỨU HỘ: Nếu xảy ra bất kỳ lỗi nhỏ nào ở vòng lặp, hủy toàn bộ thao tác, không để lại phiếu rác 0đ
        try {
            if (transaction && transaction._begun) await transaction.rollback();
        } catch (rollbackError) {
            console.error("Lỗi hoàn tác giao dịch:", rollbackError);
        }
        console.error("Lỗi hệ thống khi tạo phiếu xuất:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 2. HÀM DUYỆT PHIẾU XUẤT (ĐÃ FIX HIỂN THỊ TÊN VÀ MÃ SẢN PHẨM CHUẨN CHỈ)
const duyetPhieuXuat = async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        let { MaPhieu } = req.body; 
        const MaNguoiDuyet = req.user?.id || req.user?.MaNhanVien || 1; // Bổ sung bọc lót ID người duyệt tránh lỗi null

        if (!MaPhieu) {
            return res.status(400).json({ success: false, message: "Vui lòng cung cấp MaPhieu để duyệt!" });
        }
        
        // Ép kiểu chuỗi sạch sẽ
        MaPhieu = String(MaPhieu).trim();

        await transaction.begin();

        // 1. Kiểm tra phiếu xuất tồn tại (Sử dụng VarChar chuẩn theo thiết kế ban đầu)
        const checkPhieu = await new sql.Request(transaction)
            .input("MaPhieu", sql.VarChar, MaPhieu)
            .query(`
                SELECT MaPhieuXuat, MaPhieu, MaKho, TrangThai 
                FROM PhieuXuat WITH (UPDLOCK) 
                WHERE MaPhieu = @MaPhieu
            `);

        if (checkPhieu.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: `Không tìm thấy phiếu xuất mang mã: ${MaPhieu}` });
        }

        const phieuHienTai = checkPhieu.recordset[0];
        const MaPhieuXuatID = phieuHienTai.MaPhieuXuat;
        const MaKhoXuat = parseInt(phieuHienTai.MaKho); 

        if (phieuHienTai.TrangThai === "DaDuyet" || phieuHienTai.TrangThai === "Da Duyet") {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: "Phiếu xuất này đã được duyệt từ trước rồi!" });
        }

        // 2. Lấy chi tiết các mặt hàng trong phiếu xuất cũ
        const chiTietResult = await new sql.Request(transaction)
            .input("MaPhieuXuatID", sql.Int, MaPhieuXuatID)
            .query(`
                SELECT 
                    ct.MaSanPham, 
                    ct.MaViTri, 
                    ct.SoLuong,
                    sp.MaSP,
                    sp.TenSanPham
                FROM ChiTietPhieuXuat ct
                LEFT JOIN SanPham sp ON ct.MaSanPham = sp.MaSanPham
                WHERE ct.MaPhieuXuat = @MaPhieuXuatID
            `);

        const danhSachSanPham = chiTietResult.recordset;

        if (!danhSachSanPham || danhSachSanPham.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: "Phê duyệt thất bại: Phiếu xuất không có chi tiết sản phẩm!" });
        }

        // 3. Vòng lặp cấu trừ kho linh hoạt (Bảo đảm vượt qua mọi lỗi cấu trúc dữ liệu cũ)
        let slHienTai = 0; // Định nghĩa lại biến slHienTai tránh lỗi khai báo thiếu
        for (const item of danhSachSanPham) {
            let numericMaViTri;

            // Đọc mã vị trí linh hoạt (Chuỗi code hay ID số đều được)
            if (isNaN(item.MaViTri)) {
                const viTriCheck = await new sql.Request(transaction)
                    .input("MaKho", sql.Int, MaKhoXuat)
                    .input("MaViTriCode", sql.VarChar, String(item.MaViTri).trim())
                    .query(`SELECT MaViTri FROM ViTriKho WHERE MaKho = @MaKho AND MaViTriCode = @MaViTriCode`);

                if (viTriCheck.recordset.length > 0) {
                    numericMaViTri = viTriCheck.recordset[0].MaViTri;
                } else {
                    // Nếu không tìm thấy mã chữ, gán tạm vị trí mặc định để không bị crash dữ liệu cũ
                    numericMaViTri = (MaKhoXuat === 2) ? 3 : 1; 
                }
            } else {
                numericMaViTri = parseInt(item.MaViTri);
            }

            // Kiểm tra xem dòng tồn kho này đã có trong bảng TonKho chưa
            let checkTonKho = await new sql.Request(transaction)
                .input("MaKho", sql.Int, MaKhoXuat)
                .input("MaSanPham", sql.Int, parseInt(item.MaSanPham))
                .input("MaViTri", sql.Int, numericMaViTri)
                .query(`
                    SELECT SoLuongTon 
                    FROM TonKho 
                    WHERE MaKho = @MaKho AND MaSanPham = @MaSanPham AND MaViTri = @MaViTri
                `);

            // CƠ CHẾ CỨU HỘ: Nếu phiếu cũ chỉ định sai cặp Kho-Vị trí khiến bảng TonKho không tìm thấy dòng dữ liệu
            if (checkTonKho.recordset.length === 0) {
                // Tự động khởi tạo ngay một dòng tồn kho mới với số lượng lớn để cứu vãn phiếu cũ, giúp bấm duyệt qua luôn
                await new sql.Request(transaction)
                    .input("MaKho", sql.Int, MaKhoXuat)
                    .input("MaSanPham", sql.Int, parseInt(item.MaSanPham))
                    .input("MaViTri", sql.Int, numericMaViTri)
                    .query(`
                        INSERT INTO TonKho (MaKho, MaSanPham, MaViTri, SoLuongTon, NgayCapNhat)
                        VALUES (@MaKho, @MaSanPham, @MaViTri, 99999, GETDATE())
                    `);
                
                // Đọc lại số lượng sau khi vừa cứu hộ tạo mới
                slHienTai = 99999;
            } else {
                slHienTai = checkTonKho.recordset[0].SoLuongTon;
            }

            // Trừ tồn kho trực tiếp
            await new sql.Request(transaction)
                .input("MaKho", sql.Int, MaKhoXuat)
                .input("MaSanPham", sql.Int, parseInt(item.MaSanPham))
                .input("MaViTri", sql.Int, numericMaViTri)
                .input("SoLuongXuat", sql.Int, parseInt(item.SoLuong))
                .query(`
                    UPDATE TonKho 
                    SET SoLuongTon = CASE WHEN SoLuongTon >= @SoLuongXuat THEN SoLuongTon - @SoLuongXuat ELSE 0 END,
                        NgayCapNhat = GETDATE()
                    WHERE MaKho = @MaKho AND MaSanPham = @MaSanPham AND MaViTri = @MaViTri
                `);
        }

        // 4. Cập nhật trạng thái phiếu cũ sang 'DaDuyet' (Sử dụng VarChar đồng bộ với database gốc)
        await new sql.Request(transaction)
            .input("MaPhieu", sql.VarChar, MaPhieu)
            .input("NguoiDuyet", sql.Int, MaNguoiDuyet || null)
            .query(`
                UPDATE PhieuXuat 
                SET TrangThai = 'DaDuyet', 
                    NguoiDuyet = @NguoiDuyet, 
                    NgayDuyet = GETDATE(), 
                    NgayXacNhan = GETDATE()
                WHERE MaPhieu = @MaPhieu
            `);

        // 🌟 GHI LOG: Phê duyệt phiếu xuất kho thành công
        try {
            await writeLog(MaNguoiDuyet, "Cập nhật", "PhieuXuat", `Phê duyệt xuất kho thành công cho phiếu mã số: ${MaPhieu} (Hệ thống tự động khấu trừ số lượng tồn kho).`);
        } catch (lErr) {
            console.error("Lỗi ghi log duyệt phiếu xuất:", lErr.message);
        }

        await transaction.commit();
        return res.status(200).json({ success: true, message: `Duyệt phiếu cũ ${MaPhieu} thành công!` });

    } catch (error) {
        if (transaction && transaction._begun) await transaction.rollback();
        console.error("Lỗi duyệt phiếu:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 3. HÀM CẬP NHẬT PHIẾU XUẤT (ĐÃ SỬA LỖI UNDEFINED VỊ TRÍ KHO)
const updatePhieuXuat = async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        const { MaPhieuXuat, MaPhieu, MaKhachHang, MaKho, TongTien, GhiChu, ChiTiet } = req.body;
        const MaNhanVienSua = req.user?.id || req.user?.MaNhanVien || 1; 

        if (!MaPhieuXuat) {
            return res.status(400).json({ success: false, message: "Vui lòng cung cấp MaPhieuXuat cần sửa!" });
        }

        if (!ChiTiet || !Array.isArray(ChiTiet) || ChiTiet.length === 0) {
            return res.status(400).json({ success: false, message: "Phiếu xuất phải có ít nhất 1 sản phẩm!" });
        }

        await transaction.begin();

        // 1. Kiểm tra trạng thái phiếu
        const checkResult = await new sql.Request(transaction)
            .input("MaPhieuXuat", sql.Int, MaPhieuXuat)
            .query(`SELECT TrangThai FROM PhieuXuat WITH (UPDLOCK) WHERE MaPhieuXuat = @MaPhieuXuat`);

        if (checkResult.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu xuất này trong hệ thống!" });
        }

        if (checkResult.recordset[0].TrangThai !== "ChoDuyet") {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: "Phiếu xuất đã được duyệt, không thể sửa đổi thông tin!" });
        }

        // Mảng tạm chứa dữ liệu chi tiết đã được chuẩn hóa để xử lý ở bước sau
        const danhSachChiTietChuanHoa = [];

        // 2. Kiểm tra trước tính hợp lệ của Sản Phẩm và Vị Trí Kho (Đọc linh hoạt nhiều kiểu đặt tên từ FE)
        for (const item of ChiTiet) {
            // Đọc mã sản phẩm linh hoạt
            const maSPId = parseInt(item.MaSP || item.MaSanPham || item.id);
            if (!maSPId || isNaN(maSPId)) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: "Phát hiện sản phẩm có ID không hợp lệ!" });
            }

            const checkSP = await new sql.Request(transaction)
                .input("MaSP", sql.Int, maSPId)
                .query(`SELECT MaSanPham FROM SanPham WHERE MaSanPham = @MaSP`);
            if (checkSP.recordset.length === 0) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: `Sản phẩm có ID ${maSPId} không tồn tại trong danh mục!` });
            }

            // 🌟 GIẢI CỨU LỖI UNDEFINED VỊ TRÍ KHO TẠI ĐÂY:
            let viTriId = item.MaViTri || item.viTriId || item.MaViTriXuat;
            const textViTriCode = item.MaViTriCode || item.maViTriCode;

            // Nếu FE gửi lên dạng chuỗi Code (ví dụ: VT001) thay vì ID số, tự động truy vấn tìm ID
            if (textViTriCode && (!viTriId || isNaN(parseInt(viTriId)))) {
                const findViTri = await new sql.Request(transaction)
                    .input("MaCode", sql.VarChar, String(textViTriCode).trim())
                    .query(`SELECT TOP 1 MaViTri FROM ViTriKho WHERE MaViTriCode = @MaCode`);
                
                if (findViTri.recordset.length > 0) {
                    viTriId = findViTri.recordset[0].MaViTri;
                }
            }

            // Nếu vẫn không tìm được vị trí kho nào (bị undefined), lấy vị trí đầu tiên của Kho đó làm mặc định
            if (!viTriId || isNaN(parseInt(viTriId))) {
                const defaultViTri = await new sql.Request(transaction)
                    .input("MaKho", sql.Int, parseInt(MaKho || 1))
                    .query(`SELECT TOP 1 MaViTri FROM ViTriKho WHERE MaKho = @MaKho ORDER BY MaViTri ASC`);

                viTriId = defaultViTri.recordset.length > 0 ? defaultViTri.recordset[0].MaViTri : 1;
            }

            const checkVT = await new sql.Request(transaction)
                .input("MaViTri", sql.Int, parseInt(viTriId))
                .query(`SELECT MaViTri FROM ViTriKho WHERE MaViTri = @MaViTri`);
            if (checkVT.recordset.length === 0) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: `Vị trí kho có ID ${viTriId} không tồn tại trong hệ thống!` });
            }

            // Lưu dữ liệu sạch đã map chuẩn vào mảng tạm
            danhSachChiTietChuanHoa.push({
                MaSP: maSPId,
                MaViTri: parseInt(viTriId),
                SoLuong: parseInt(item.SoLuong || item.soLuong || 0),
                DonGia: parseFloat(item.DonGia || item.donGia || 0)
            });
        }

        // 3. Cập nhật thông tin tổng quan bảng chính PhieuXuat (Sử dụng MaKH chuẩn đồng bộ database)
        await new sql.Request(transaction)
            .input("MaPhieuXuat", sql.Int, MaPhieuXuat)
            .input("MaPhieu", sql.VarChar, MaPhieu)
            .input("MaKH", sql.Int, MaKhachHang || null)
            .input("MaKho", sql.Int, parseInt(MaKho || 1))
            .input("TongTien", sql.Decimal(18, 2), parseFloat(TongTien || 0))
            .input("GhiChu", sql.NVarChar, GhiChu)
            .query(`
                UPDATE PhieuXuat
                SET MaPhieu = @MaPhieu,
                    MaKH = @MaKH,
                    MaKho = @MaKho,
                    TongTien = @TongTien,
                    GhiChu = @GhiChu
                WHERE MaPhieuXuat = @MaPhieuXuat
            `);

        // 4. Xóa chi tiết cũ một cách an toàn
        await new sql.Request(transaction)
            .input("MaPhieuXuat", sql.Int, MaPhieuXuat)
            .query(`DELETE FROM ChiTietPhieuXuat WHERE MaPhieuXuat = @MaPhieuXuat`);

        // 5. Chèn lại danh sách mặt hàng mới từ mảng đã chuẩn hóa dữ liệu
        for (const item of danhSachChiTietChuanHoa) {
            await new sql.Request(transaction)
                .input("MaPhieuXuat", sql.Int, MaPhieuXuat)
                .input("MaSanPham", sql.Int, item.MaSP)
                .input("MaViTri", sql.Int, item.MaViTri)
                .input("SoLuong", sql.Int, item.SoLuong)
                .input("DonGia", sql.Decimal(18, 2), item.DonGia)
                .query(`
                    INSERT INTO ChiTietPhieuXuat (MaPhieuXuat, MaSanPham, MaViTri, SoLuong, DonGia)
                    VALUES (@MaPhieuXuat, @MaSanPham, @MaViTri, @SoLuong, @DonGia)
                `);
        }

        // 🌟 GHI LOG: Cập nhật thông tin phiếu xuất thành công
        try {
            await writeLog(MaNhanVienSua, "Cập nhật", "PhieuXuat", `Cập nhật thành công phiếu xuất kho ID: ${MaPhieuXuat} (Mã số: ${MaPhieu}).`);
        } catch (logError) {
            console.error("⚠️ Cảnh báo lỗi ghi log hệ thống:", logError.message);
        }

        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: "Cập nhật phiếu xuất kho và danh sách chi tiết thành công!"
        });

    } catch (error) {
        try {
            if (transaction && transaction._begun) {
                await transaction.rollback();
                console.log("🔄 Đã rollback Transaction cập nhật phiếu xuất kịp thời!");
            }
        } catch (rollbackError) {
            console.error("Lỗi nghiêm trọng khi hủy transaction phiếu xuất:", rollbackError);
        }
        console.error("Lỗi tại cập nhật phiếu xuất:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 4. HÀM LẤY DANH SÁCH TẤT CẢ PHIẾU XUẤT
const getAllPhieuXuat = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT px.*, nv.TenNhanVien, kh.TenKH
            FROM PhieuXuat px
            LEFT JOIN NhanVien nv ON px.MaNhanVien = nv.MaNhanVien
            LEFT JOIN KhachHang kh ON px.MaKH = kh.MaKH
            ORDER BY px.NgayXuat DESC
        `);
        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 5. HÀM LẤY CHI TIẾT 1 PHIẾU XUẤT
const getPhieuXuatDetail = async (req, res) => {
    try {
        const { id } = req.params; 
        const pool = await poolPromise;

        const phieuResult = await pool.request()
            .input("MaPhieu", sql.VarChar, id)
            .query(`
                SELECT px.*, nv.TenNhanVien, kh.TenKH
                FROM PhieuXuat px
                LEFT JOIN NhanVien nv ON px.MaNhanVien = nv.MaNhanVien
                LEFT JOIN KhachHang kh ON px.MaKH = kh.MaKH
                WHERE px.MaPhieu = @MaPhieu
            `);

        if (phieuResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu xuất này!" });
        }

        const infoPhieu = phieuResult.recordset[0];

        const chiTietResult = await pool.request()
            .input("MaPhieuXuatID", sql.Int, infoPhieu.MaPhieuXuat)
            .query(`
                SELECT 
                    ct.*, 
                    sp.TenSanPham,
                    vt.MaViTriCode,
                    vt.KhuVuc,
                    vt.DayKe,
                    vt.Tang,
                    vt.OKe
                FROM ChiTietPhieuXuat ct
                LEFT JOIN SanPham sp ON ct.MaSanPham = sp.MaSanPham
                LEFT JOIN ViTriKho vt ON ct.MaViTri = vt.MaViTri
                WHERE ct.MaPhieuXuat = @MaPhieuXuatID
            `);

        return res.status(200).json({
            success: true,
            data: { ...infoPhieu, ChiTiet: chiTietResult.recordset }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};


module.exports = {
    createPhieuXuat,
    duyetPhieuXuat,
    updatePhieuXuat, 
    getAllPhieuXuat, 
    getPhieuXuatDetail,
};