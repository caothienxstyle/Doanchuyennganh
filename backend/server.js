const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const logRoutes = require("./routes/logRoutes");


require("./db/data");

const app = express();

app.use(cors());
app.use(express.json());

// auth routes
app.use("/auth", authRoutes);

app.get("/", (req, res) => {
    res.send("Backend running");
});

app.use("/admin", adminRoutes);

app.use("/logs", logRoutes);

const spRoutes = require("./routes/spRoutes");
app.use("/products", spRoutes);

const tonKhoRoutes = require("./routes/tonKhoRoutes");
app.use("/tonkho", tonKhoRoutes);

const dashboardRoutes = require("./routes/dashboardRoutes");
app.use("/dashboard", dashboardRoutes);

const phieunhapRoutes = require("./routes/phieunhapRoutes");
app.use("/phieunhap", phieunhapRoutes);

const phieuxuatRoutes = require("./routes/phieuxuatRoutes");
app.use("/phieuxuat", phieuxuatRoutes);

const danhmucRoutes = require("./routes/danhmucRoutes");
app.use("/danhmuc", danhmucRoutes);

const khachHangRoutes = require("./routes/khachHangRoutes");
app.use("/khachhang", khachHangRoutes);

const nhaCungCapRouter = require("./routes/nhaCungCapRouter");
app.use("/nhacungcap", nhaCungCapRouter);

const donViTinhRouter = require("./routes/donViTinhRouter");
app.use("/donvitinh", donViTinhRouter);

const khoRouter = require("./routes/KhoRoutes");
app.use("/kho", khoRouter);

const viTriKhoRouter = require("./routes/VitrikhoRoutes");
app.use("/vitrikho", viTriKhoRouter);

const nhanVienRoutes = require("./routes/nhanVienRoutes");
app.use("/nhanvien", nhanVienRoutes);

const TaikhoanRoutes = require("./routes/TaikhoanRoutes");
app.use("/taikhoan", TaikhoanRoutes);

const rolePermissionRoutes = require("./routes/rolePermissionRoutes");
app.use("/phanquyen", rolePermissionRoutes);

// Standardized filename (remove the trailing space from the actual file on disk as well)
const Baohanhroutes = require("./routes/Baohanhroutes"); 
app.use("/baohanh", Baohanhroutes);

const phieuBaoHanhRoutes = require("./routes/Phieubaohanhroutes");
app.use("/phieubaohanh", phieuBaoHanhRoutes);


const path = require("path");
app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);
app.listen(3000, () => {

    console.log("Server running at http://localhost:3000");

});