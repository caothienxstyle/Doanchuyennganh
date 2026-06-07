const { sql, poolPromise } = require("../db/data");

// API lấy 4 con số tổng quan trên đầu Dashboard
const getCardStats = async (req, res) => {
    try {
        const pool = await poolPromise;

        // Chạy đồng thời các câu lệnh COUNT để tối ưu tốc độ
        const [userCount, productCount, categoryCount, logCount] = await Promise.all([
            pool.request().query("SELECT COUNT(*) AS Total FROM NhanVien WHERE IsDeleted = 0"),
            pool.request().query("SELECT COUNT(*) AS Total FROM SanPham WHERE IsDeleted = 0"),
            pool.request().query("SELECT COUNT(*) AS Total FROM DanhMuc WHERE IsDeleted = 0"),
            pool.request().query("SELECT COUNT(*) AS Total FROM LichSuThaoTac")
        ]);

        res.json({
            success: true,
            data: {
                totalUsers: userCount.recordset[0].Total,
                totalProducts: productCount.recordset[0].Total,
                totalCategories: categoryCount.recordset[0].Total,
                totalLogs: logCount.recordset[0].Total
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getCardStats
};