const sql = require("mssql");
const { poolPromise } = require("../db/data");
const { writeLog } = require("./logController");


const getAllPhieuBaoHanh = async (req, res) => {
    try {
        const pool = await poolPromise;
        const trang   = parseInt(req.query.trang)   || 1;
        const soLuong = parseInt(req.query.soLuong) || 10;
        const offset  = (trang - 1) * soLuong;
        const { loaiPhieu, tuKhoa, tuNgay, denNgay } = req.query;

        let where = "WHERE 1=1";
        if (loaiPhieu) where += " AND pb.LoaiPhieuBH = @loaiPhieu";
        if (tuKhoa) {
            where += ` AND (
                pb.SoHopDong LIKE '%' + @tuKhoa + '%' 
                OR pb.GhiChuTongQuat LIKE N'%' + @tuKhoa + '%' 
                OR nv.TenNhanVien LIKE N'%' + @tuKhoa + '%'
                OR CAST(pb.MaPhieuBH AS VARCHAR) LIKE '%' + @tuKhoa + '%'
            )`;
        }
        if (tuNgay)  where += " AND CAST(pb.NgayTaoPhieu AS DATE) >= @tuNgay";
        if (denNgay) where += " AND CAST(pb.NgayTaoPhieu AS DATE) <= @denNgay";

        const buildReq = (r) => {
            if (loaiPhieu) r.input("loaiPhieu", sql.NVarChar, loaiPhieu);
            if (tuKhoa)    r.input("tuKhoa",    sql.NVarChar, tuKhoa);
            if (tuNgay)    r.input("tuNgay",    sql.Date,     new Date(tuNgay));
            if (denNgay)   r.input("denNgay",   sql.Date,     new Date(denNgay));
            return r;
        };

        const tongResult = await buildReq(pool.request()).query(`
            SELECT COUNT(*) AS TongSo
            FROM PhieuBaoHanh pb
            LEFT JOIN NhanVien nv ON pb.MaNhanVienLap = nv.MaNhanVien
            ${where}
        `);
        const tongSo = tongResult.recordset[0].TongSo;

        const dataReq = buildReq(pool.request());
        dataReq.input("offset",   sql.Int, offset);
        dataReq.input("soLuong",  sql.Int, soLuong);

        const result = await dataReq.query(`
            SELECT
                pb.MaPhieuBH,
                pb.LoaiPhieuBH,
                pb.MaDoiTac,
                CASE
                    WHEN pb.LoaiPhieuBH = 'KHACH_HANG'   THEN kh.TenKH
                    WHEN pb.LoaiPhieuBH = 'NHA_CUNG_CAP' THEN ncc.TenNCC
                    ELSE NULL
                END AS TenDoiTac,
                pb.SoHopDong,
                pb.NgayTaoPhieu,
                pb.MaNhanVienLap,
                nv.TenNhanVien AS TenNhanVienLap,
                pb.GhiChuTongQuat,

                (SELECT TOP 1 b.HanBaoHanh_KhachHang
                 FROM BaoHanhSanPham b
                 WHERE b.MaPhieuBH = pb.MaPhieuBH
                   AND b.HanBaoHanh_KhachHang IS NOT NULL
                 ORDER BY b.HanBaoHanh_KhachHang ASC) AS HanBaoHanh_KhachHang,

                (SELECT TOP 1 b.HanBaoHanh_NCC
                 FROM BaoHanhSanPham b
                 WHERE b.MaPhieuBH = pb.MaPhieuBH
                   AND b.HanBaoHanh_NCC IS NOT NULL
                 ORDER BY b.HanBaoHanh_NCC ASC) AS HanBaoHanh_NCC,

                (SELECT ISNULL(SUM(CAST(b.SoLuong AS INT)), 0)
                 FROM BaoHanhSanPham b
                 WHERE b.MaPhieuBH = pb.MaPhieuBH) AS SoLuong,

                ISNULL(
                    (SELECT TOP 1 px.MaPhieu
                     FROM BaoHanhSanPham b
                     LEFT JOIN PhieuXuat px ON b.MaPhieuXuat = px.MaPhieuXuat
                     WHERE b.MaPhieuBH = pb.MaPhieuBH AND b.MaPhieuXuat IS NOT NULL),
                    (SELECT TOP 1 pn.MaPhieu
                     FROM BaoHanhSanPham b
                     LEFT JOIN PhieuNhap pn ON b.MaPhieuNhap = pn.MaPhieuNhap
                     WHERE b.MaPhieuBH = pb.MaPhieuBH AND b.MaPhieuNhap IS NOT NULL)
                ) AS MaGoc,

                (SELECT TOP 1 px.MaPhieu
                 FROM BaoHanhSanPham b
                 LEFT JOIN PhieuXuat px ON b.MaPhieuXuat = px.MaPhieuXuat
                 WHERE b.MaPhieuBH = pb.MaPhieuBH AND b.MaPhieuXuat IS NOT NULL) AS MaPhieuXuatHienThi,

                (SELECT TOP 1 pn.MaPhieu
                 FROM BaoHanhSanPham b
                 LEFT JOIN PhieuNhap pn ON b.MaPhieuNhap = pn.MaPhieuNhap
                 WHERE b.MaPhieuBH = pb.MaPhieuBH AND b.MaPhieuNhap IS NOT NULL) AS MaPhieuNhapHienThi

            FROM PhieuBaoHanh pb
            LEFT JOIN NhanVien   nv  ON pb.MaNhanVienLap = nv.MaNhanVien
            LEFT JOIN KhachHang  kh  ON pb.LoaiPhieuBH = 'KHACH_HANG'   AND pb.MaDoiTac = kh.MaKH
            LEFT JOIN NhaCungCap ncc ON pb.LoaiPhieuBH = 'NHA_CUNG_CAP' AND pb.MaDoiTac = ncc.MaNCC
            ${where}
            ORDER BY pb.NgayTaoPhieu DESC
            OFFSET @offset ROWS FETCH NEXT @soLuong ROWS ONLY
        `);

        return res.json({
            success: true,
            data: result.recordset,
            phanTrang: { trang, soLuong, tongSo, tongTrang: Math.ceil(tongSo / soLuong) }
        });

    } catch (error) {
        console.error("Lỗi lấy danh sách phiếu bảo hành:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getPhieuBaoHanhById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;

        // Lấy thông tin phiếu
        const phieuResult = await pool.request()
            .input("MaPhieuBH", sql.Int, parseInt(id))
            .query(`
                SELECT
                    pb.MaPhieuBH,
                    pb.LoaiPhieuBH,
                    pb.MaDoiTac,
                    CASE
                        WHEN pb.LoaiPhieuBH = 'KHACH_HANG'   THEN kh.TenKH
                        WHEN pb.LoaiPhieuBH = 'NHA_CUNG_CAP' THEN ncc.TenNCC
                        ELSE NULL
                    END AS TenDoiTac,
                    pb.SoHopDong,
                    pb.NgayTaoPhieu,
                    pb.MaNhanVienLap,
                    nv.TenNhanVien AS TenNhanVienLap,
                    pb.GhiChuTongQuat,
                    -- Bổ sung mã chứng từ gốc vào Header để FE không bị undefined
                    ISNULL(
                        (SELECT TOP 1 px.MaPhieu FROM BaoHanhSanPham bh LEFT JOIN PhieuXuat px ON bh.MaPhieuXuat = px.MaPhieuXuat WHERE bh.MaPhieuBH = pb.MaPhieuBH AND bh.MaPhieuXuat IS NOT NULL),
                        (SELECT TOP 1 pn.MaPhieu FROM BaoHanhSanPham bh LEFT JOIN PhieuNhap pn ON bh.MaPhieuNhap = pn.MaPhieuNhap WHERE bh.MaPhieuBH = pb.MaPhieuBH AND bh.MaPhieuNhap IS NOT NULL)
                    ) AS MaGoc,
                    (SELECT TOP 1 px.MaPhieu 
                     FROM BaoHanhSanPham bh 
                     LEFT JOIN PhieuXuat px ON bh.MaPhieuXuat = px.MaPhieuXuat 
                     WHERE bh.MaPhieuBH = pb.MaPhieuBH AND bh.MaPhieuXuat IS NOT NULL) AS MaPhieuXuatHienThi,
                    (SELECT TOP 1 pn.MaPhieu 
                     FROM BaoHanhSanPham bh 
                     LEFT JOIN PhieuNhap pn ON bh.MaPhieuNhap = pn.MaPhieuNhap 
                     WHERE bh.MaPhieuBH = pb.MaPhieuBH AND bh.MaPhieuNhap IS NOT NULL) AS MaPhieuNhapHienThi
                FROM PhieuBaoHanh pb
                LEFT JOIN NhanVien   nv  ON pb.MaNhanVienLap = nv.MaNhanVien
                LEFT JOIN KhachHang  kh  ON pb.LoaiPhieuBH = 'KHACH_HANG'   AND pb.MaDoiTac = kh.MaKH
                LEFT JOIN NhaCungCap ncc ON pb.LoaiPhieuBH = 'NHA_CUNG_CAP' AND pb.MaDoiTac = ncc.MaNCC
                WHERE pb.MaPhieuBH = @MaPhieuBH
            `);

        if (phieuResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu bảo hành!" });
        }

        // Lấy danh sách SP bảo hành thuộc phiếu này
        const chiTietResult = await pool.request()
            .input("MaPhieuBH", sql.Int, parseInt(id))
            .query(`
                SELECT
                    bh.MaBaoHanh,
                    bh.MaSanPham,
                    sp.TenSanPham,
                    bh.MaKho,
                    k.TenKho,
                    bh.MaViTri,
                    CONCAT_WS(' / ',
                        NULLIF(vt.KhuVuc, ''), NULLIF(vt.DayKe, ''),
                        NULLIF(vt.Tang,   ''), NULLIF(vt.OKe,   '')
                    ) AS TenViTri,
                    bh.SoSerial,
                    bh.SoLo,
                    bh.NgayNhapKho,
                    bh.HanBaoHanh_NCC,
                    bh.HanBaoHanh_KhachHang,
                    bh.NgayXuatKho,
                    bh.NgayBaoHanh,
                    bh.LoaiBaoHanh,
                    bh.TinhTrangLoi,
                    bh.HuongXuLy,
                    bh.SoLuong, -- Đã là SoLuong
                    bh.TrangThai,
                    bh.GhiChu,
                    bh.MaPhieuXuat,
                    px.MaPhieu AS MaPhieuXuatHienThi,
                    ISNULL(px.MaPhieu, pn.MaPhieu) AS MaGoc,
                    bh.MaPhieuNhap,
                    pn.MaPhieu AS MaPhieuNhapHienThi
                FROM BaoHanhSanPham bh
                LEFT JOIN SanPham  sp ON bh.MaSanPham = sp.MaSanPham
                LEFT JOIN Kho       k ON bh.MaKho     = k.MaKho
                LEFT JOIN ViTriKho vt ON bh.MaViTri   = vt.MaViTri
                LEFT JOIN PhieuXuat px ON bh.MaPhieuXuat = px.MaPhieuXuat
                LEFT JOIN PhieuNhap pn ON bh.MaPhieuNhap = pn.MaPhieuNhap
                WHERE bh.MaPhieuBH = @MaPhieuBH
                ORDER BY bh.MaBaoHanh ASC
            `);

        return res.json({
            success: true,
            data: {
                ...phieuResult.recordset[0],
                ChiTiet: chiTietResult.recordset
            }
        });
    } catch (error) {
        console.error("Lỗi lấy chi tiết phiếu bảo hành:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const createPhieuBaoHanh = async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        const {
            LoaiPhieuBH, MaDoiTac, SoHopDong,
            GhiChuTongQuat, DanhSachMaBaoHanh
        } = req.body;
        // DanhSachMaBaoHanh: [1, 2, 3] — mảng MaBaoHanh muốn gom vào phiếu này (tùy chọn)
        const MaNhanVienLap = req.user.id;

        if (!LoaiPhieuBH) {
            return res.status(400).json({ success: false, message: "LoaiPhieuBH không được để trống!" });
        }
        if (!["KHACH_HANG", "NHA_CUNG_CAP"].includes(LoaiPhieuBH)) {
            return res.status(400).json({ success: false, message: "LoaiPhieuBH chỉ nhận: KHACH_HANG hoặc NHA_CUNG_CAP!" });
        }

        await transaction.begin();

        // Tạo phiếu
        const phieuResult = await new sql.Request(transaction)
            .input("LoaiPhieuBH",    sql.NVarChar, LoaiPhieuBH)
            .input("MaDoiTac",       sql.Int,      MaDoiTac      ? parseInt(MaDoiTac)      : null)
            .input("SoHopDong",      sql.VarChar,  SoHopDong?.trim()     || null)
            .input("MaNhanVienLap",  sql.Int,      MaNhanVienLap)
            .input("GhiChuTongQuat", sql.NVarChar, GhiChuTongQuat?.trim() || null)
            .query(`
                INSERT INTO PhieuBaoHanh (LoaiPhieuBH, MaDoiTac, SoHopDong, MaNhanVienLap, GhiChuTongQuat)
                OUTPUT INSERTED.MaPhieuBH, INSERTED.LoaiPhieuBH, INSERTED.NgayTaoPhieu
                VALUES (@LoaiPhieuBH, @MaDoiTac, @SoHopDong, @MaNhanVienLap, @GhiChuTongQuat)
            `);

        const newPhieu = phieuResult.recordset[0];
        const MaPhieuBH = newPhieu.MaPhieuBH;

        // Gán phiếu vào từng BaoHanhSanPham nếu có
        let soSanPhamGan = 0;
        if (Array.isArray(DanhSachMaBaoHanh) && DanhSachMaBaoHanh.length > 0) {
            for (const maBH of DanhSachMaBaoHanh) {
                await new sql.Request(transaction)
                    .input("MaPhieuBH",  sql.Int, MaPhieuBH)
                    .input("MaBaoHanh",  sql.Int, parseInt(maBH))
                    .query(`
                        UPDATE BaoHanhSanPham
                        SET MaPhieuBH = @MaPhieuBH
                        WHERE MaBaoHanh = @MaBaoHanh
                    `);
                soSanPhamGan++;
            }
        }

        await transaction.commit();

        try {
            await writeLog(MaNhanVienLap, "Thêm mới", "PhieuBaoHanh",
                `Tạo phiếu BH ID ${MaPhieuBH} loại ${LoaiPhieuBH} — gán ${soSanPhamGan} SP`);
        } catch (logErr) { console.error("⚠️ Lỗi ghi log:", logErr.message); }

        return res.status(201).json({
            success: true,
            message: `Tạo phiếu bảo hành thành công! Đã gán ${soSanPhamGan} sản phẩm vào phiếu.`,
            data: newPhieu
        });
    } catch (error) {
        try { if (transaction._begun) await transaction.rollback(); } catch (_) {}
        console.error("Lỗi tạo phiếu bảo hành:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// PUT /phieubaohanh/capnhat/:id
// ============================================================
const updatePhieuBaoHanh = async (req, res) => {
    try {
        const { id } = req.params;
        const { MaDoiTac, SoHopDong, GhiChuTongQuat } = req.body;
        const MaNhanVien = req.user.id;

        const pool = await poolPromise;

        const check = await pool.request()
            .input("MaPhieuBH", sql.Int, parseInt(id))
            .query("SELECT MaPhieuBH, LoaiPhieuBH FROM PhieuBaoHanh WHERE MaPhieuBH = @MaPhieuBH");

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu bảo hành!" });
        }
        const loai = check.recordset[0].LoaiPhieuBH;

        await pool.request()
            .input("MaPhieuBH",      sql.Int,      parseInt(id))
            .input("MaDoiTac",       sql.Int,      MaDoiTac      ? parseInt(MaDoiTac) : null)
            .input("SoHopDong",      sql.VarChar,  SoHopDong?.trim()      || null)
            .input("GhiChuTongQuat", sql.NVarChar, GhiChuTongQuat?.trim() || null)
            .query(`
                UPDATE PhieuBaoHanh SET
                    MaDoiTac       = @MaDoiTac,
                    SoHopDong      = @SoHopDong,
                    GhiChuTongQuat = @GhiChuTongQuat
                WHERE MaPhieuBH = @MaPhieuBH
            `);

        try {
            await writeLog(MaNhanVien, "Cập nhật", "PhieuBaoHanh",
                `Cập nhật phiếu BH ID ${id} loại ${loai}`);
        } catch (logErr) { console.error("⚠️ Lỗi ghi log:", logErr.message); }

        return res.json({ success: true, message: "Cập nhật phiếu bảo hành thành công!" });
    } catch (error) {
        console.error("Lỗi cập nhật phiếu bảo hành:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const themSanPhamVaoPhieu = async (req, res) => {
    try {
        const { id } = req.params;
        const { DanhSachMaBaoHanh } = req.body;
        // DanhSachMaBaoHanh: [4, 5, 6]
        const MaNhanVien = req.user.id;

        if (!Array.isArray(DanhSachMaBaoHanh) || DanhSachMaBaoHanh.length === 0) {
            return res.status(400).json({ success: false, message: "DanhSachMaBaoHanh phải có ít nhất 1 phần tử!" });
        }

        const pool = await poolPromise;

        const check = await pool.request()
            .input("MaPhieuBH", sql.Int, parseInt(id))
            .query("SELECT MaPhieuBH FROM PhieuBaoHanh WHERE MaPhieuBH = @MaPhieuBH");

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu bảo hành!" });
        }

        let soGan = 0;
        for (const maBH of DanhSachMaBaoHanh) {
            await pool.request()
                .input("MaPhieuBH", sql.Int, parseInt(id))
                .input("MaBaoHanh", sql.Int, parseInt(maBH))
                .query(`
                    UPDATE BaoHanhSanPham
                    SET MaPhieuBH = @MaPhieuBH
                    WHERE MaBaoHanh = @MaBaoHanh
                `);
            soGan++;
        }

        try {
            await writeLog(MaNhanVien, "Cập nhật", "PhieuBaoHanh",
                `Thêm ${soGan} SP vào phiếu BH ID ${id}`);
        } catch (logErr) { console.error("⚠️ Lỗi ghi log:", logErr.message); }

        return res.json({ success: true, message: `Đã thêm ${soGan} sản phẩm vào phiếu bảo hành!` });
    } catch (error) {
        console.error("Lỗi thêm SP vào phiếu:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};


const deletePhieuBaoHanh = async (req, res) => {
    try {
        const { id } = req.params;
        const MaNhanVien = req.user.id;
        const pool = await poolPromise;

        const check = await pool.request()
            .input("MaPhieuBH", sql.Int, parseInt(id))
            .query(`
                SELECT pb.MaPhieuBH, pb.LoaiPhieuBH,
                    (SELECT COUNT(*) FROM BaoHanhSanPham WHERE MaPhieuBH = pb.MaPhieuBH) AS SoSP
                FROM PhieuBaoHanh pb
                WHERE pb.MaPhieuBH = @MaPhieuBH
            `);

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu bảo hành!" });
        }

        const { LoaiPhieuBH, SoSP } = check.recordset[0];

        await pool.request()
            .input("MaPhieuBH", sql.Int, parseInt(id))
            .query("DELETE FROM PhieuBaoHanh WHERE MaPhieuBH = @MaPhieuBH");

        try {
            await writeLog(MaNhanVien, "Xóa", "PhieuBaoHanh",
                `Xóa phiếu BH ID ${id} loại ${LoaiPhieuBH} — cascade xóa ${SoSP} SP liên quan`);
        } catch (logErr) { console.error("⚠️ Lỗi ghi log:", logErr.message); }

        return res.json({
            success: true,
            message: `Đã xóa phiếu bảo hành và ${SoSP} sản phẩm liên quan!`
        });
    } catch (error) {
        console.error("Lỗi xóa phiếu bảo hành:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllPhieuBaoHanh,
    getPhieuBaoHanhById,
    createPhieuBaoHanh,
    updatePhieuBaoHanh,
    themSanPhamVaoPhieu,
    deletePhieuBaoHanh,
};