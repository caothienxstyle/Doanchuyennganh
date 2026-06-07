const { sql, poolPromise } = require("../db/data");
const writeLog = require("./logController").writeLog; 

// 1. HÀM LẤY DANH SÁCH SẢN PHẨM VỚI TÙY CHỌN TÌM KIẾM
const getProducts = async (req, res) => {
    try {
        // Lấy các tham số tìm kiếm từ URL query
        const { search, barcode, masp } = req.query; 
        const pool = await poolPromise;

        // Câu lệnh gốc kết hợp JOIN để lấy tên chữ danh mục và đơn vị tính
        let queryStr = `
            SELECT sp.*, dm.TenDanhMuc, dv.TenDonVi 
            FROM SanPham sp
            LEFT JOIN DanhMuc dm ON sp.MaDanhMuc = dm.MaDanhMuc
            LEFT JOIN DonViTinh dv ON sp.MaDonVi = dv.MaDonVi
            WHERE sp.IsDeleted = 0
        `;

        const request = pool.request();

        // TRƯỜNG HỢP 1: Tìm CHÍNH XÁC theo Mã Sản Phẩm (Ví dụ: ?masp=SP001)
        if (masp) {
            queryStr += ` AND sp.MaSP = @masp`;
            request.input("masp", sql.VarChar, masp.trim());
        } 
        // TRƯỜNG HỢP 2: Tìm CHÍNH XÁC theo Mã Vạch Barcode (Ví dụ: ?barcode=474575444528)
        else if (barcode) {
            queryStr += ` AND sp.Barcode = @barcode`;
            request.input("barcode", sql.VarChar, barcode.trim());
        } 
        // TRƯỜNG HỢP 3: Tìm GẦN ĐÚNG theo Tên Sản Phẩm (Ví dụ: ?search=chuột)
        else if (search) {
            queryStr += ` AND sp.TenSanPham LIKE @searchKeyword`;
            request.input("searchKeyword", sql.NVarChar, `%${search.trim()}%`);
        }

        // Sắp xếp sản phẩm mới lên đầu
        queryStr += ` ORDER BY sp.MaSanPham DESC`;

        const result = await request.query(queryStr);

        // Nếu tìm theo mã chính xác (masp hoặc barcode) mà thấy kết quả, 
        // trả về luôn object đầu tiên cho gọn, không cần để trong mảng []
        if ((masp || barcode) && result.recordset.length > 0) {
            return res.json({
                success: true,
                data: result.recordset[0] // Trả về duy nhất 1 sản phẩm
            });
        }

        // Ngược lại nếu tìm theo tên hoặc lấy tất cả thì trả về dạng danh sách mảng
        res.json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// 2. HÀM TẠO MỚI SẢN PHẨM + TỰ ĐỘNG TẠO DÒNG TỒN KHO
const createProduct = async (req, res) => {
    // Khởi tạo transaction để đảm bảo an toàn dữ liệu
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
                const {
                    MaSP,
                    Barcode,
                    QRCode,
                    TenSanPham,
                    MaDanhMuc,
                    MaDonVi,
                    MoTa,
                    SoLuongToiThieu,
                    SoLuongTon
                } = req.body;

                // Nếu FE upload ảnh
                const AnhSanPham = req.file
                    ? `/uploads/products/${req.file.filename}`
                    : null;

        // ==========================================
        // BƯỚC 1: KIỂM TRA BẮT BUỘC (VALIDATION)
        // ==========================================
        if (!MaSP || MaSP.trim() === "") {
            return res.status(400).json({ success: false, message: "Lỗi: Mã sản phẩm (MaSP) không được để trống!" });
        }
        if (!TenSanPham || TenSanPham.trim() === "") {
            return res.status(400).json({ success: false, message: "Lỗi: Tên sản phẩm không được để trống!" });
        }
        if (!MaDanhMuc || (typeof MaDanhMuc === 'string' && MaDanhMuc.trim() === "")) {
            return res.status(400).json({ success: false, message: "Lỗi: Danh mục không được để trống!" });
        }
        if (!MaDonVi || (typeof MaDonVi === 'string' && MaDonVi.trim() === "")) {
            return res.status(400).json({ success: false, message: "Lỗi: Đơn vị tính không được để trống!" });
        }

        // Bắt đầu Transaction
        await transaction.begin();

        // ==========================================
        // BƯỚC 2: XỬ LÝ DANH MỤC (TỰ ĐỘNG THÊM NẾU LÀ CHỮ)
        // ==========================================
        let finalMaDanhMuc;
        
        if (!isNaN(MaDanhMuc)) {
            finalMaDanhMuc = parseInt(MaDanhMuc, 10);
        } else {
            const tenDM = MaDanhMuc.trim();
            
            const checkCatResult = await new sql.Request(transaction)
                .input("TenDanhMuc", sql.NVarChar, tenDM)
                .query(`SELECT MaDanhMuc FROM DanhMuc WHERE TenDanhMuc = @TenDanhMuc`);

            if (checkCatResult.recordset.length > 0) {
                finalMaDanhMuc = checkCatResult.recordset[0].MaDanhMuc;
            } else {
                const insertCatResult = await new sql.Request(transaction)
                    .input("TenDanhMuc", sql.NVarChar, tenDM)
                    .query(`
                        INSERT INTO DanhMuc (TenDanhMuc) 
                        OUTPUT INSERTED.MaDanhMuc 
                        VALUES (@TenDanhMuc)
                    `);
                finalMaDanhMuc = insertCatResult.recordset[0].MaDanhMuc;
            }
        }

        // ==========================================
        // BƯỚC 3: XỬ LÝ ĐƠN VỊ TÍNH (TỰ ĐỘNG THÊM NẾU LÀ CHỮ)
        // ==========================================
        let finalMaDonVi;

        if (!isNaN(MaDonVi)) {
            finalMaDonVi = parseInt(MaDonVi, 10);
        } else {
            const tenDV = MaDonVi.trim();

            const checkUnitResult = await new sql.Request(transaction)
                .input("TenDonVi", sql.NVarChar, tenDV)
                .query(`SELECT MaDonVi FROM DonViTinh WHERE TenDonVi = @TenDonVi`);

            if (checkUnitResult.recordset.length > 0) {
                finalMaDonVi = checkUnitResult.recordset[0].MaDonVi;
            } else {
                const insertUnitResult = await new sql.Request(transaction)
                    .input("TenDonVi", sql.NVarChar, tenDV)
                    .query(`
                        INSERT INTO DonViTinh (TenDonVi) 
                        OUTPUT INSERTED.MaDonVi 
                        VALUES (@TenDonVi)
                    `);
                finalMaDonVi = insertUnitResult.recordset[0].MaDonVi;
            }
        }

        // ==========================================
        // BƯỚC 4: CHÈN THẲNG VÀO BẢNG SANPHAM
        // ==========================================
        const insertProductResult = await new sql.Request(transaction)
            .input("MaSP", sql.VarChar, MaSP.trim())
            .input("Barcode", sql.VarChar, Barcode || null)
            .input("QRCode", sql.NVarChar, QRCode || null)
            .input("TenSanPham", sql.NVarChar, TenSanPham.trim())
            .input("MaDanhMuc", sql.Int, finalMaDanhMuc) 
            .input("MaDonVi", sql.Int, finalMaDonVi)     
            .input("MoTa", sql.NVarChar, MoTa || null)
            .input("AnhSanPham", sql.NVarChar, AnhSanPham || null)
            .input("SoLuongToiThieu", sql.Int, parseInt(SoLuongToiThieu, 10) || 0)
            .query(`
                INSERT INTO SanPham(MaSP, Barcode, QRCode, TenSanPham, MaDanhMuc, MaDonVi, MoTa, AnhSanPham, SoLuongToiThieu)
                OUTPUT INSERTED.MaSanPham
                VALUES(@MaSP, @Barcode, @QRCode, @TenSanPham, @MaDanhMuc, @MaDonVi, @MoTa, @AnhSanPham, @SoLuongToiThieu)
            `);

        const MaSanPhamVuaTao = insertProductResult.recordset[0].MaSanPham;

        // ==========================================
        // BƯỚC 5: TỰ ĐỘNG INSERT SANG BẢNG TONKHO
        // ==========================================
        const macDinhMaKho = 1;
        const macDinhMaViTri = 1; 
        const parsedSoLuongTon = parseInt(SoLuongTon, 10) || 0;

        await new sql.Request(transaction)
            .input("MaKho", sql.Int, macDinhMaKho)
            .input("MaSanPham", sql.Int, MaSanPhamVuaTao)
            .input("MaViTri", sql.Int, macDinhMaViTri)
            .input("SoLuongTon", sql.Int, parsedSoLuongTon)
            .query(`
                INSERT INTO TonKho (MaKho, MaSanPham, MaViTri, SoLuongTon, NgayCapNhat)
                VALUES (@MaKho, @MaSanPham, @MaViTri, @SoLuongTon, GETDATE()) 
            `);

        // ==========================================
        // BƯỚC 6: LƯU LỊCH SỬ THAO TÁC (🌟 ĐÃ ĐỔI SANG WRITE_LOG)
        // ==========================================
        const maNhanVienTạo = req.user?.id || req.user?.maNhanVien || 1;
        try {
            await writeLog(maNhanVienTạo, "Thêm mới", "SanPham", `Thêm sản phẩm: ${TenSanPham} (Mã: ${MaSP}), Tồn đầu: ${parsedSoLuongTon}`);
        } catch (logError) {
            console.error("⚠️ Cảnh báo lỗi ghi log tạo sản phẩm:", logError.message);
        }

        // Xác nhận thành công và commit toàn bộ thay đổi dữ liệu
        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: "Tạo sản phẩm mới và tự động cập nhật số lượng Tồn Kho thành công!"
        });

    } catch (error) {
        if (transaction && transaction._begun) {
            await transaction.rollback();
        }
        
        console.error("Lỗi tạo sản phẩm:", error);
        
        return res.status(500).json({
            success: false,
            message: error.message.includes("Violation of PRIMARY KEY") 
                ? "Lỗi: Mã sản phẩm này đã tồn tại trong hệ thống!" 
                : error.message
        });
    }
};

// 3. HÀM LẤY CHI TIẾT 1 SẢN PHẨM THEO ID CHÍNH
const getProductById = async (req, res) => {
    try {
        const { id } = req.params; 
        const pool = await poolPromise;

        const result = await pool.request()
            .input("id", sql.Int, id)
            .query(`
                SELECT sp.*, dm.TenDanhMuc, dv.TenDonVi 
                FROM SanPham sp
                LEFT JOIN DanhMuc dm ON sp.MaDanhMuc = dm.MaDanhMuc
                LEFT JOIN DonViTinh dv ON sp.MaDonVi = dv.MaDonVi
                WHERE sp.MaSanPham = @id AND sp.IsDeleted = 0
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm yêu cầu hoặc sản phẩm đã bị xóa."
            });
        }

        res.json({
            success: true,
            data: result.recordset[0]
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. HÀM CẬP NHẬT THÔNG TIN SẢN PHẨM
const updateProduct = async (req, res) => {
    try {

        if (!req.body) {
            return res.status(400).json({
                success: false,
                message: "req.body đang undefined"
            });
        }
        const {
                MaSP,
                Barcode,
                QRCode,
                TenSanPham,
                MaDanhMuc,
                MaDonVi,
                MoTa,
                SoLuongToiThieu
            } = req.body;

            const pool = await poolPromise;

            // Nếu không upload ảnh mới thì lấy ảnh cũ
            let AnhSanPham = null;

            if (req.file) {
                AnhSanPham = `/uploads/products/${req.file.filename}`;
            } else {
                const oldImage = await pool.request()
                    .input("MaSP", sql.VarChar, MaSP.trim())
                    .query(`
                        SELECT AnhSanPham
                        FROM SanPham
                        WHERE MaSP = @MaSP
                    `);

                AnhSanPham =
                    oldImage.recordset.length > 0
                        ? oldImage.recordset[0].AnhSanPham
                        : null;
            }

        if (!MaSP || MaSP.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Lỗi: Không tìm thấy Mã sản phẩm (MaSP) cần cập nhật!"
            });
        }

        if (!TenSanPham || TenSanPham.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Lỗi: Tên sản phẩm không được để trống!"
            });
        }

        // CẬP NHẬT THẲNG VÀO BẢNG SANPHAM BẰNG MADANHMUC VÀ MADONVI (DẠNG SỐ)
        await pool.request()
            .input("MaSP", sql.VarChar, MaSP.trim())
            .input("Barcode", sql.VarChar, Barcode || null)
            .input("QRCode", sql.NVarChar, QRCode || null)
            .input("TenSanPham", sql.NVarChar, TenSanPham.trim())
            .input("MaDanhMuc", sql.Int, parseInt(MaDanhMuc, 10))
            .input("MaDonVi", sql.Int, parseInt(MaDonVi, 10))
            .input("MoTa", sql.NVarChar, MoTa || null)
            .input("AnhSanPham", sql.NVarChar, AnhSanPham || null)
            .input("SoLuongToiThieu", sql.Int, parseInt(SoLuongToiThieu, 10) || 0)
            .query(`
                UPDATE SanPham
                SET 
                    Barcode = @Barcode,
                    QRCode = @QRCode,
                    TenSanPham = @TenSanPham,
                    MaDanhMuc = @MaDanhMuc,
                    MaDonVi = @MaDonVi,
                    MoTa = @MoTa,
                    AnhSanPham = @AnhSanPham,
                    SoLuongToiThieu = @SoLuongToiThieu
                WHERE MaSP = @MaSP
            `);

        // Lưu lịch sử thao tác cập nhật (🌟 ĐÃ ĐỔI SANG WRITE_LOG)
        const maNhanVienSua = req.user?.id || req.user?.maNhanVien || 1;
        try {
            await writeLog(maNhanVienSua, "Cập nhật", "SanPham", `Cập nhật sản phẩm: ${TenSanPham} (Mã: ${MaSP})`);
        } catch (logError) {
            console.error("⚠️ Cảnh báo lỗi ghi log cập nhật sản phẩm:", logError.message);
        }

        return res.status(200).json({
            success: true,
            message: "Cập nhật thông tin sản phẩm thành công!"
        });

    } catch (error) {
        console.error("Lỗi cập nhật sản phẩm:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// 5. HÀM XÓA MỀM SẢN PHẨM (ĐƯA VÀO THÙNG RÁC)
const deleteProduct = async (req, res) => {
    try {
        const { MaSP } = req.body;

        if (!MaSP || MaSP.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Lỗi: Không nhận được Mã sản phẩm (MaSP) cần ẩn!"
            });
        }

        const pool = await poolPromise;

        // THAY VÌ DELETE, CHÚNG TA UPDATE LẠI CỘT ISDELETED THÀNH 1 (TRUE)
        const result = await pool.request()
            .input("MaSP", sql.VarChar, MaSP.trim())
            .query("UPDATE SanPham SET IsDeleted = 1 WHERE MaSP = @MaSP");

        // Kiểm tra xem có dòng nào được update không
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: `Lỗi: Không tìm thấy sản phẩm mã ${MaSP} để xóa!`
            });
        }

        // Ghi lịch sử thao tác (🌟 ĐÃ ĐỔI SANG WRITE_LOG)
        const maNhanVienXoa = req.user?.id || req.user?.maNhanVien || 1;
        try {
            await writeLog(maNhanVienXoa, "Xóa mềm", "SanPham", `Xóa mềm sản phẩm có Mã: ${MaSP.trim()}`);
        } catch (logError) {
            console.error("⚠️ Cảnh báo lỗi ghi log xóa sản phẩm:", logError.message);
        }

        return res.status(200).json({
            success: true,
            message: "Xóa sản phẩm thành công (Đã chuyển vào thùng rác/ẩn)!"
        });

    } catch (error) {
        console.error("Lỗi xóa mềm sản phẩm:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi xóa sản phẩm: " + error.message
        });
    }
};

// 6. HÀM CẢNH BÁO SẢN PHẨM SẮP HẾT HÀNG (TỒN KHO THẤP)
const getLowStockProducts = async (req, res) => {
    try {
        const pool = await poolPromise;

        // Truy vấn lấy các sản phẩm có SoLuongTon <= SoLuongToiThieu
        // Lấy TOP 5 sản phẩm hết nhiều nhất giống như UI hiển thị
        const result = await pool.request().query(`
            SELECT TOP 5 
                sp.MaSP, 
                sp.TenSanPham, 
                ISNULL(tk.SoLuongTon, 0) AS SoLuongTon, 
                sp.SoLuongToiThieu
            FROM SanPham sp
            LEFT JOIN TonKho tk ON sp.MaSanPham = tk.MaSanPham
            WHERE sp.IsDeleted = 0 AND ISNULL(tk.SoLuongTon, 0) <= sp.SoLuongToiThieu
            ORDER BY ISNULL(tk.SoLuongTon, 0) ASC
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getProducts,
    getProductById, 
    createProduct,
    updateProduct,  
    deleteProduct,
    getLowStockProducts   
};