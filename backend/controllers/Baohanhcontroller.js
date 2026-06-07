const sql = require("mssql");
const { poolPromise } = require("../db/data");
const { writeLog } = require("./logController");

// =========================================================
// 1. GET ALL - LẤY DANH SÁCH BẢO HÀNH (PHÂN TRANG + LỌC)
// =========================================================
const getAllBaoHanh = async (req, res) => {
    try {
        const pool = await poolPromise;
        const trang    = parseInt(req.query.trang)    || 1;
        const soLuong  = parseInt(req.query.soLuong)  || 10;
        const offset   = (trang - 1) * soLuong;

        const { tuKhoa, trangThai, maSanPham, maNCC, maKho, maPhieuXuat, maPhieuNhap, tuNgay, denNgay } = req.query;

        let where = "WHERE 1=1";
        if (tuKhoa)       where += ` AND (bh.SoSerial LIKE '%' + @tuKhoa + '%' OR bh.SoLo LIKE N'%' + @tuKhoa + '%' OR sp.TenSanPham LIKE N'%' + @tuKhoa + '%' OR px.MaPhieu LIKE '%' + @tuKhoa + '%' OR pn.MaPhieu LIKE '%' + @tuKhoa + '%')`;
        if (trangThai)    where += " AND bh.TrangThai = @trangThai";
        if (maSanPham)    where += " AND bh.MaSanPham = @maSanPham";
        if (maNCC)        where += " AND bh.MaNCC = @maNCC";
        if (maKho)        where += " AND bh.MaKho = @maKho";
        if (maPhieuXuat)  where += " AND bh.MaPhieuXuat = @maPhieuXuat";
        if (maPhieuNhap)  where += " AND bh.MaPhieuNhap = @maPhieuNhap";
        if (tuNgay)       where += " AND CAST(bh.NgayBaoHanh AS DATE) >= @tuNgay";
        if (denNgay)      where += " AND CAST(bh.NgayBaoHanh AS DATE) <= @denNgay";

        const buildReq = (r) => {
            r.input("tuKhoa", sql.NVarChar, tuKhoa || "");
            if (trangThai)   r.input("trangThai", sql.NVarChar, trangThai);
            if (maSanPham)   r.input("maSanPham", sql.Int,      parseInt(maSanPham));
            if (maNCC)       r.input("maNCC",     sql.Int,      parseInt(maNCC));
            if (maKho)       r.input("maKho",     sql.Int,      parseInt(maKho));
            if (maPhieuXuat) r.input("maPhieuXuat", sql.Int,    parseInt(maPhieuXuat));
            if (maPhieuNhap) r.input("maPhieuNhap", sql.Int,    parseInt(maPhieuNhap));
            if (tuNgay)      r.input("tuNgay",    sql.Date,     new Date(tuNgay));
            if (denNgay)     r.input("denNgay",   sql.Date,     new Date(denNgay));
            return r;
        };

        // Đếm tổng số lượng bản ghi
        const tongResult = await buildReq(pool.request()).query(`
            SELECT COUNT(*) AS TongSo
            FROM [dbo].[BaoHanhSanPham] bh
            LEFT JOIN SanPham     sp ON bh.MaSanPham = sp.MaSanPham
            LEFT JOIN PhieuXuat   px ON bh.MaPhieuXuat = px.MaPhieuXuat 
            LEFT JOIN PhieuNhap   pn ON bh.MaPhieuNhap = pn.MaPhieuNhap
            ${where}
        `);
        const tongSo = tongResult.recordset[0].TongSo;

        // Lấy dữ liệu kèm JOIN thêm bảng PhieuXuat
        const dataReq = buildReq(pool.request());
        dataReq.input("offset",   sql.Int, offset);
        dataReq.input("soLuong",  sql.Int, soLuong);

        const result = await dataReq.query(`
            SELECT
                bh.*,
                sp.TenSanPham,
                k.TenKho,
                ncc.TenNCC,
                CONCAT_WS(' / ', NULLIF(vt.KhuVuc, ''), NULLIF(vt.DayKe, ''), NULLIF(vt.Tang, ''), NULLIF(vt.OKe, '')) AS TenViTri,
                -- Bốc cột MaPhieu từ bảng phiếu gốc đặt tên hiển thị rõ ràng:
                px.MaPhieu AS MaPhieuXuatHienThi,
                pn.MaPhieu AS MaPhieuNhapHienThi,
                -- Gộp mã chứng từ gốc (PX/PN) vào key MaGoc để FE hiển thị
                ISNULL(px.MaPhieu, pn.MaPhieu) AS MaGoc,
                nv.TenNhanVien AS TenNhanVienBaoHanh
            FROM [dbo].[BaoHanhSanPham] bh
            LEFT JOIN SanPham     sp  ON bh.MaSanPham = sp.MaSanPham
            LEFT JOIN Kho         k   ON bh.MaKho     = k.MaKho
            LEFT JOIN NhaCungCap  ncc ON bh.MaNCC     = ncc.MaNCC
            LEFT JOIN ViTriKho    vt  ON bh.MaViTri   = vt.MaViTri
            LEFT JOIN NhanVien    nv  ON bh.MaNhanVienBaoHanh = nv.MaNhanVien
            LEFT JOIN PhieuXuat   px  ON bh.MaPhieuXuat = px.MaPhieuXuat 
            LEFT JOIN PhieuNhap   pn  ON bh.MaPhieuNhap = pn.MaPhieuNhap
            ${where}
            ORDER BY bh.CreatedAt DESC
            OFFSET @offset ROWS FETCH NEXT @soLuong ROWS ONLY
        `);

        return res.json({
            success: true,
            data: result.recordset,
            phanTrang: { trang, soLuong, tongSo, tongTrang: Math.ceil(tongSo / soLuong) }
        });
    } catch (error) {
        console.error("Lỗi lấy danh sách bảo hành:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =========================================================
// 2. GET BY ID - LẤY CHI TIẾT PHIẾU BẢO HÀNH
// =========================================================
const getBaoHanhById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;

        const result = await pool.request()
            .input("MaBaoHanh", sql.Int, parseInt(id))
            .query(`
                SELECT
                    bh.*,
                    sp.TenSanPham,
                    k.TenKho,
                    ncc.TenNCC,
                    -- Bốc cột MaPhieu từ bảng phiếu gốc đặt tên hiển thị rõ ràng:
                    px.MaPhieu AS MaPhieuXuatHienThi,
                    pn.MaPhieu AS MaPhieuNhapHienThi,
                    -- Gộp mã chứng từ gốc (PX/PN) vào key MaGoc để FE hiển thị
                    ISNULL(px.MaPhieu, pn.MaPhieu) AS MaGoc,
                    CONCAT_WS(' / ', NULLIF(vt.KhuVuc, ''), NULLIF(vt.DayKe, ''), NULLIF(vt.Tang, ''), NULLIF(vt.OKe, '')) AS TenViTri,
                    nv.TenNhanVien AS TenNhanVienBaoHanh
                FROM [dbo].[BaoHanhSanPham] bh
                LEFT JOIN SanPham     sp  ON bh.MaSanPham = sp.MaSanPham
                LEFT JOIN Kho         k   ON bh.MaKho     = k.MaKho
                LEFT JOIN NhaCungCap  ncc ON bh.MaNCC     = ncc.MaNCC
                LEFT JOIN ViTriKho    vt  ON bh.MaViTri   = vt.MaViTri
                LEFT JOIN NhanVien    nv  ON bh.MaNhanVienBaoHanh = nv.MaNhanVien
                LEFT JOIN PhieuXuat   px  ON bh.MaPhieuXuat = px.MaPhieuXuat
                LEFT JOIN PhieuNhap   pn  ON bh.MaPhieuNhap = pn.MaPhieuNhap
                WHERE bh.MaBaoHanh = @MaBaoHanh
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu bảo hành!" });
        }
        return res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        console.error("Lỗi lấy chi tiết bảo hành:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =========================================================
// 3. POST - TẠO MỚI 
// =========================================================
const createBaoHanh = async (req, res) => {
    try {
        const {
            MaSanPham, MaKho, MaNCC, MaViTri, MaPhieuXuat, MaPhieuNhap, MaPhieu,
            SoSerial, DanhSachSerial, SoLo, NgayNhapKho, HanBaoHanh,
            NgayBaoHanh, LoaiBaoHanh, TinhTrangLoi,
            HuongXuLy, SoLuong, TrangThai,
            MaNhanVienBaoHanh, GhiChu
        } = req.body;
        
        const MaNhanVien = req.user?.id || null; 

        if (!MaSanPham) return res.status(400).json({ success: false, message: "MaSanPham không được để trống!" });
        if (!MaKho)     return res.status(400).json({ success: false, message: "MaKho không được để trống!" });

        const pool = await poolPromise;

        let listSerials = [];
        let isBulk = false;

        if (Array.isArray(DanhSachSerial) && DanhSachSerial.length > 0) {
            listSerials = DanhSachSerial.map(s => s.toString().trim());
            isBulk = true;
        } else if (SoSerial && SoSerial.trim() !== "") {
            listSerials.push(SoSerial.trim());
        } else {
            listSerials.push(null);
        }

        const insertedRecords = [];

        for (let currentSerial of listSerials) {
            const result = await pool.request()
                .input("MaSanPham",         sql.Int,      parseInt(MaSanPham))
                .input("MaKho",             sql.Int,      parseInt(MaKho))
                .input("MaNCC",             sql.Int,      MaNCC ? parseInt(MaNCC) : null)
                .input("MaViTri",           sql.Int,      MaViTri ? parseInt(MaViTri) : null)
                .input("MaPhieuXuat",       sql.Int,      (MaPhieuXuat || MaPhieu) ? parseInt(MaPhieuXuat || MaPhieu) : null)
                .input("MaPhieuNhap",       sql.Int,      MaPhieuNhap ? parseInt(MaPhieuNhap) : null)
                .input("SoSerial",          sql.VarChar,  currentSerial)
                .input("SoLo",              sql.NVarChar, SoLo?.trim() || null)
                .input("NgayNhapKho",       sql.DateTime, NgayNhapKho ? new Date(NgayNhapKho) : null)
                .input("HanBaoHanh_NCC",    sql.Date,     HanBaoHanh ? new Date(HanBaoHanh) : null) // ĐÃ SỬA TÊN CỘT
                .input("NgayBaoHanh",       sql.DateTime, NgayBaoHanh ? new Date(NgayBaoHanh) : null)
                .input("LoaiBaoHanh",       sql.NVarChar, LoaiBaoHanh?.trim() || null)
                .input("TinhTrangLoi",      sql.NVarChar, TinhTrangLoi?.trim() || null)
                .input("HuongXuLy",         sql.NVarChar, HuongXuLy?.trim() || null)
                .input("SoLuong",           sql.Int,      isBulk ? 1 : (parseInt(SoLuong || 1)))
                .input("TrangThai",         sql.NVarChar, TrangThai?.trim() || 'ChoBaoHanh')
                .input("MaNhanVienBaoHanh", sql.Int,      MaNhanVienBaoHanh ? parseInt(MaNhanVienBaoHanh) : null)
                .input("GhiChu",            sql.NVarChar, GhiChu?.trim() || null)
                .query(`
                    INSERT INTO [dbo].[BaoHanhSanPham] (
                        MaSanPham, MaKho, MaNCC, MaViTri, MaPhieuXuat, MaPhieuNhap, SoSerial, SoLo,
                        NgayNhapKho, HanBaoHanh_NCC, NgayBaoHanh, LoaiBaoHanh, -- ĐÃ SỬA TÊN CỘT
                        TinhTrangLoi, HuongXuLy, SoLuong, TrangThai,
                        MaNhanVienBaoHanh, GhiChu, CreatedAt
                    )
                    OUTPUT
                        INSERTED.MaBaoHanh, INSERTED.SoSerial, INSERTED.SoLuong, INSERTED.CreatedAt
                    VALUES (
                        @MaSanPham, @MaKho, @MaNCC, @MaViTri, @MaPhieuXuat, @MaPhieuNhap, @SoSerial, @SoLo,
                        @NgayNhapKho, @HanBaoHanh_NCC, @NgayBaoHanh, @LoaiBaoHanh,
                        @TinhTrangLoi, @HuongXuLy, @SoLuong, @TrangThai,
                        @MaNhanVienBaoHanh, @GhiChu, GETDATE()
                    )
                `);
            
            if (result.recordset.length > 0) {
                insertedRecords.push(result.recordset[0]);
            }
        }

        try {
            if (MaNhanVien && insertedRecords.length > 0) {
                const totalInserted = insertedRecords.length;
                const listIds = insertedRecords.map(r => r.MaBaoHanh).join(', ');
                await writeLog(MaNhanVien, 'Thêm mới', 'BaoHanhSanPham',
                    `Tạo thành công ${totalInserted} phiếu bảo hành. Danh sách ID: [${listIds}]`);
            }
        } catch (logErr) { console.error("⚠️ Lỗi ghi log:", logErr.message); }

        return res.status(201).json({ 
            success: true, 
            message: `Đã xử lý thành công phiếu bảo hành!`, 
            total: insertedRecords.length,
            data: insertedRecords 
        });

    } catch (error) {
        console.error("Lỗi tạo phiếu bảo hành:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =========================================================
// 4. PUT - CẬP NHẬT TOÀN BỘ PHIẾU BẢO HÀNH (UPDATE)
// =========================================================
const updateBaoHanh = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            MaViTri, MaPhieuXuat, MaPhieuNhap, MaPhieu, SoSerial, SoLo, NgayNhapKho,
            HanBaoHanh, NgayBaoHanh, LoaiBaoHanh,
            TinhTrangLoi, HuongXuLy, SoLuong,
            TrangThai, MaNhanVienBaoHanh, GhiChu
        } = req.body;
        
        const MaNhanVien = req.user?.id || null;
        const pool = await poolPromise;

        const check = await pool.request()
            .input("MaBaoHanh", sql.Int, parseInt(id))
            .query("SELECT MaBaoHanh, TrangThai FROM [dbo].[BaoHanhSanPham] WHERE MaBaoHanh = @MaBaoHanh");

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu bảo hành!" });
        }
        const trangThaiCu = check.recordset[0].TrangThai;

        await pool.request()
            .input("MaBaoHanh",         sql.Int,      parseInt(id))
            .input("MaViTri",           sql.Int,      MaViTri ? parseInt(MaViTri) : null)
            .input("MaPhieuXuat",       sql.Int,      (MaPhieuXuat || MaPhieu) ? parseInt(MaPhieuXuat || MaPhieu) : null)
            .input("MaPhieuNhap",       sql.Int,      MaPhieuNhap ? parseInt(MaPhieuNhap) : null)
            .input("SoSerial",          sql.VarChar,  SoSerial?.trim() || null)
            .input("SoLo",              sql.NVarChar, SoLo?.trim() || null)
            .input("NgayNhapKho",       sql.DateTime, NgayNhapKho ? new Date(NgayNhapKho) : null)
            .input("HanBaoHanh_NCC",    sql.Date,     HanBaoHanh ? new Date(HanBaoHanh) : null)
            .input("NgayBaoHanh",       sql.DateTime, NgayBaoHanh ? new Date(NgayBaoHanh) : null)
            .input("LoaiBaoHanh",       sql.NVarChar, LoaiBaoHanh?.trim() || null)
            .input("TinhTrangLoi",      sql.NVarChar, TinhTrangLoi?.trim() || null)
            .input("HuongXuLy",         sql.NVarChar, HuongXuLy?.trim() || null)
            .input("SoLuong",           sql.Int,      Math.max(1, parseInt(SoLuong || 1)))
            .input("TrangThai",         sql.NVarChar, TrangThai?.trim() || trangThaiCu)
            .input("MaNhanVienBaoHanh", sql.Int,      MaNhanVienBaoHanh ? parseInt(MaNhanVienBaoHanh) : null)
            .input("GhiChu",            sql.NVarChar, GhiChu?.trim() || null)
            .query(`
                UPDATE [dbo].[BaoHanhSanPham] SET
                    MaViTri           = @MaViTri,
                    MaPhieuXuat       = @MaPhieuXuat,
                    MaPhieuNhap       = @MaPhieuNhap,
                    SoSerial          = @SoSerial,
                    SoLo              = @SoLo,
                    NgayNhapKho       = @NgayNhapKho,
                    HanBaoHanh_NCC    = @HanBaoHanh_NCC, -- ĐÃ SỬA TÊN CỘT
                    NgayBaoHanh       = @NgayBaoHanh,
                    LoaiBaoHanh       = @LoaiBaoHanh,
                    TinhTrangLoi      = @TinhTrangLoi,
                    HuongXuLy         = @HuongXuLy,
                    SoLuong           = @SoLuong,
                    TrangThai         = @TrangThai,
                    MaNhanVienBaoHanh = @MaNhanVienBaoHanh,
                    GhiChu            = @GhiChu,
                    UpdatedAt         = GETDATE()
                WHERE MaBaoHanh = @MaBaoHanh
            `);

        try {
            if (MaNhanVien) {
                await writeLog(MaNhanVien, 'Cập nhật', 'BaoHanhSanPham',
                    `Cập nhật phiếu BH ID ${id} — TrangThai: "${trangThaiCu}" → "${TrangThai || trangThaiCu}"`);
            }
        } catch (logErr) { console.error("⚠️ Lỗi ghi log:", logErr.message); }

        return res.json({ success: true, message: "Cập nhật phiếu bảo hành thành công!" });
    } catch (error) {
        console.error("Lỗi cập nhật phiếu bảo hành:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =========================================================
// 5. PATCH - CẬP NHẬT NHANH TRẠNG THÁI & HƯỚNG XỬ LÝ
// =========================================================
const updateTrangThai = async (req, res) => {
    try {
        const { id } = req.params;
        const { TrangThai, HuongXuLy, GhiChu } = req.body;
        const MaNhanVien = req.user?.id || null;

        if (!TrangThai?.trim()) {
            return res.status(400).json({ success: false, message: "TrangThai không được để trống!" });
        }

        const pool = await poolPromise;

        const check = await pool.request()
            .input("MaBaoHanh", sql.Int, parseInt(id))
            .query("SELECT MaBaoHanh, TrangThai FROM [dbo].[BaoHanhSanPham] WHERE MaBaoHanh = @MaBaoHanh");

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu bảo hành!" });
        }
        const trangThaiCu = check.recordset[0].TrangThai;

        await pool.request()
            .input("MaBaoHanh", sql.Int,      parseInt(id))
            .input("TrangThai", sql.NVarChar, TrangThai.trim())
            .input("HuongXuLy", sql.NVarChar, HuongXuLy?.trim() || null)
            .input("GhiChu",    sql.NVarChar, GhiChu?.trim()    || null)
            .query(`
                UPDATE [dbo].[BaoHanhSanPham] SET
                    TrangThai = @TrangThai,
                    HuongXuLy = COALESCE(@HuongXuLy, HuongXuLy),
                    GhiChu    = COALESCE(@GhiChu,    GhiChu),
                    UpdatedAt = GETDATE()
                WHERE MaBaoHanh = @MaBaoHanh
            `);

        try {
            if (MaNhanVien) {
                await writeLog(MaNhanVien, 'Cập nhật', 'BaoHanhSanPham',
                    `Đổi trạng thái BH ID ${id}: "${trangThaiCu}" → "${TrangThai.trim()}"`);
            }
        } catch (logErr) { console.error("⚠️ Lỗi ghi log:", logErr.message); }

        return res.json({ success: true, message: "Cập nhật trạng thái bảo hành thành công!" });
    } catch (error) {
        console.error("Lỗi cập nhật trạng thái bảo hành:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =========================================================
// 6. DELETE - XÓA VĨNH VIỄN PHIẾU BẢO HÀNH
// =========================================================
const deleteBaoHanh = async (req, res) => {
    try {
        const { id } = req.params;
        const MaNhanVien = req.user?.id || null;
        const pool = await poolPromise;

        const check = await pool.request()
            .input("MaBaoHanh", sql.Int, parseInt(id))
            .query("SELECT MaBaoHanh, MaSanPham, TrangThai FROM [dbo].[BaoHanhSanPham] WHERE MaBaoHanh = @MaBaoHanh");

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu bảo hành!" });
        }
        const { MaSanPham, TrangThai } = check.recordset[0];

        await pool.request()
            .input("MaBaoHanh", sql.Int, parseInt(id))
            .query("DELETE FROM [dbo].[BaoHanhSanPham] WHERE MaBaoHanh = @MaBaoHanh");

        try {
            if (MaNhanVien) {
                await writeLog(MaNhanVien, 'Xóa', 'BaoHanhSanPham',
                    `Xóa phiếu BH ID ${id} — SP: ${MaSanPham}, TrangThai: "${TrangThai}"`);
            }
        } catch (logErr) { console.error("⚠️ Lỗi ghi log:", logErr.message); }

        return res.json({ success: true, message: "Đã xóa phiếu bảo hành thành công!" });
    } catch (error) {
        console.error("Lỗi xóa phiếu bảo hành:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =========================================================
// 7. CHECK - KIỂM TRA ĐỐI SOÁT BẢO HÀNH 2 ĐẦU
// =========================================================
const checkBaoHanh = async (req, res) => {
    try {
        const { search } = req.query; 

        if (!search) {
            return res.status(400).json({ 
                success: false, 
                message: "Vui lòng nhập Mã phiếu, Số Serial hoặc Số Lô để kiểm tra!" 
            });
        }

        const pool = await poolPromise;
        
        const result = await pool.request()
            .input("SearchTerm", sql.NVarChar, String(search).trim())
            .query(`
                SELECT 
                    bh.SoSerial,
                    bh.SoLo,
                    bh.NgayNhapKho,
                    bh.HanBaoHanh_NCC,       
                    bh.NgayXuatKho,         
                    bh.HanBaoHanh_KhachHang, 
                    bh.LoaiBaoHanh,
                    bh.TinhTrangLoi,
                    px.MaPhieu,
                    sp.TenSanPham,
                    kh.TenKH,
                    kh.SDT
                FROM [dbo].[BaoHanhSanPham] bh
                LEFT JOIN [dbo].[PhieuXuat] px ON bh.MaPhieuXuat = px.MaPhieuXuat 
                LEFT JOIN [dbo].[SanPham] sp ON bh.MaSanPham = sp.MaSanPham
                LEFT JOIN KhachHang kh ON px.MaKH = kh.MaKH
                WHERE bh.SoSerial = @SearchTerm 
                   OR bh.SoLo = @SearchTerm 
                   OR px.MaPhieu = @SearchTerm 
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Không tìm thấy dữ liệu bảo hành nào khớp với từ khóa hoặc phiếu xuất này chưa được kích hoạt bảo hành!" 
            });
        }

        const info = result.recordset[0];
        const ngayHienTai = new Date();

        let tinhTrangKhach = "Không có bảo hành";
        if (info.HanBaoHanh_KhachHang) {
            const hanKhach = new Date(info.HanBaoHanh_KhachHang);
            const soNgay = Math.ceil((hanKhach - ngayHienTai) / (1000 * 60 * 60 * 24));
            tinhTrangKhach = soNgay > 0 ? `Còn bảo hành (${soNgay} ngày)` : `Đã hết hạn`;
        }

        let tinhTrangNCC = "Không có thông tin NCC";
        if (info.HanBaoHanh_NCC) {
            const hanNCC = new Date(info.HanBaoHanh_NCC);
            const soNgay = Math.ceil((hanNCC - ngayHienTai) / (1000 * 60 * 60 * 24));
            tinhTrangNCC = soNgay > 0 ? `NCC còn trách nhiệm (${soNgay} ngày)` : `⚠️ NCC ĐÃ HẾT HẠN!`;
        }

        return res.status(200).json({
            success: true,
            message: "Tra cứu hệ thống thành công!",
            data: {
                MaPhieuXuat: info.MaPhieu || "Chưa có phiếu xuất",
                TenSanPham: info.TenSanPham,
                SoSerial: info.SoSerial || "Quản lý theo Lô",
                SoLo: info.SoLo || "Quản lý theo Serial",
                BaoHanhKhachHang: {
                    KhachHang: info.TenKH || "Khách vãng lai",
                    DienThoai: info.SDT || "",
                    NgayMuaKho: info.NgayXuatKho,
                    HanBaoHanhKhach: info.HanBaoHanh_KhachHang,
                    TrangThai: tinhTrangKhach
                },
                DoiSoatNhaCungCap: {
                    NgayNhapKho: info.NgayNhapKho,
                    HanBaoHanhNCC: info.HanBaoHanh_NCC,
                    TrangThaiDoiSoat: tinhTrangNCC
                }
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllBaoHanh,
    getBaoHanhById,
    createBaoHanh,
    updateBaoHanh,
    updateTrangThai,
    deleteBaoHanh,
    checkBaoHanh
};