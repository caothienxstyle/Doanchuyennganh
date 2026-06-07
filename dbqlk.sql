
IF EXISTS (SELECT * FROM sys.databases WHERE name = 'DbQLK')
DROP DATABASE DbQLK;
GO

CREATE DATABASE DbQLK
COLLATE Vietnamese_CI_AS;
GO

USE DbQLK
GO

-- =========================================================
-- ROLE & PERMISSION
-- =========================================================

CREATE TABLE VaiTro (
    MaVaiTro INT IDENTITY PRIMARY KEY,
    TenVaiTro NVARCHAR(50) NOT NULL UNIQUE,
    MoTa NVARCHAR(255),
    CreatedAt DATETIME DEFAULT GETDATE()
);

CREATE TABLE QuyenHan (
    MaQuyen INT IDENTITY PRIMARY KEY,
    TenQuyen NVARCHAR(100) NOT NULL UNIQUE,
    MoTa NVARCHAR(255)
);

CREATE TABLE VaiTro_QuyenHan (
    MaVaiTro INT,
    MaQuyen INT,
    PRIMARY KEY (MaVaiTro, MaQuyen),

    FOREIGN KEY (MaVaiTro)
    REFERENCES VaiTro(MaVaiTro),

    FOREIGN KEY (MaQuyen)
    REFERENCES QuyenHan(MaQuyen)
);

-- =========================================================
-- NHAN VIEN
-- =========================================================

CREATE TABLE NhanVien (
    MaNhanVien INT IDENTITY PRIMARY KEY,

    TenNhanVien NVARCHAR(150) NOT NULL,

    NgaySinh DATE,

    GioiTinh BIT,

    SDT VARCHAR(15),

    Email VARCHAR(150) UNIQUE,

    CCCD VARCHAR(20) UNIQUE,

    DiaChi NVARCHAR(255),

    AnhDaiDien NVARCHAR(500),

    TrangThai BIT DEFAULT 1,

    IsDeleted BIT DEFAULT 0,

    DeletedAt DATETIME NULL,

    CreatedAt DATETIME DEFAULT GETDATE(),

    UpdatedAt DATETIME NULL,

    CONSTRAINT CK_NhanVien_SDT
    CHECK (LEN(SDT) BETWEEN 10 AND 11),

    CONSTRAINT CK_NhanVien_Email
    CHECK (Email LIKE '%@%')
);

-- =========================================================
-- TAI KHOAN
-- =========================================================

CREATE TABLE TaiKhoan (
    MaTaiKhoan INT IDENTITY PRIMARY KEY,

    TenDangNhap VARCHAR(50) NOT NULL UNIQUE,

    MatKhau VARCHAR(255) NOT NULL,

    MaNhanVien INT UNIQUE NOT NULL,

    MaVaiTro INT NOT NULL,

    TrangThai BIT DEFAULT 1,

    SoLanDangNhapSai INT DEFAULT 0,

    LanDangNhapCuoi DATETIME NULL,

    TokenResetMatKhau VARCHAR(255),

    HanResetMatKhau DATETIME,

    CreatedAt DATETIME DEFAULT GETDATE(),

    UpdatedAt DATETIME NULL,

    FOREIGN KEY (MaNhanVien)
    REFERENCES NhanVien(MaNhanVien),

    FOREIGN KEY (MaVaiTro)
    REFERENCES VaiTro(MaVaiTro)
);

-- =========================================================
-- DANH MUC
-- =========================================================

CREATE TABLE DanhMuc (
    MaDanhMuc INT IDENTITY PRIMARY KEY,

    TenDanhMuc NVARCHAR(150) NOT NULL,

    MaDanhMucCha INT NULL,

    MoTa NVARCHAR(255),

    IsDeleted BIT DEFAULT 0,

    CreatedAt DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (MaDanhMucCha)
    REFERENCES DanhMuc(MaDanhMuc)
);

-- =========================================================
-- DON VI TINH
-- =========================================================

CREATE TABLE DonViTinh (
    MaDonVi INT IDENTITY PRIMARY KEY,

    TenDonVi NVARCHAR(50) NOT NULL UNIQUE,

    MoTa NVARCHAR(255)
);

-- =========================================================
-- KHO
-- =========================================================

CREATE TABLE Kho (
    MaKho INT IDENTITY PRIMARY KEY,

    TenKho NVARCHAR(150) NOT NULL,

    DiaChi NVARCHAR(255),

    MoTa NVARCHAR(255),

    IsDeleted BIT DEFAULT 0,

    CreatedAt DATETIME DEFAULT GETDATE()
);

-- =========================================================
-- VI TRI KHO
-- =========================================================

CREATE TABLE ViTriKho (
    MaViTri INT IDENTITY PRIMARY KEY,

    MaKho INT NOT NULL,

    MaViTriCode VARCHAR(50) UNIQUE NOT NULL,

    KhuVuc NVARCHAR(50),

    DayKe NVARCHAR(50),

    Tang NVARCHAR(50),

    OKe NVARCHAR(50),

    MoTa NVARCHAR(255),

    FOREIGN KEY (MaKho)
    REFERENCES Kho(MaKho)
);

-- =========================================================
-- NHA CUNG CAP
-- =========================================================

CREATE TABLE NhaCungCap (
    MaNCC INT IDENTITY PRIMARY KEY,

    MaNCCCode VARCHAR(50) UNIQUE,

    TenNCC NVARCHAR(150) NOT NULL,

    NguoiLienHe NVARCHAR(100),

    SDT VARCHAR(15),

    Email VARCHAR(150),

    DiaChi NVARCHAR(255),

    IsDeleted BIT DEFAULT 0,

    CreatedAt DATETIME DEFAULT GETDATE()
);

-- =========================================================
-- KHACH HANG
-- =========================================================

CREATE TABLE KhachHang (
    MaKH INT IDENTITY PRIMARY KEY,

    MaKHCode VARCHAR(50) UNIQUE,

    TenKH NVARCHAR(150) NOT NULL,

    SDT VARCHAR(15),

    Email VARCHAR(150),

    DiaChi NVARCHAR(255),

    IsDeleted BIT DEFAULT 0,

    CreatedAt DATETIME DEFAULT GETDATE()
);

-- =========================================================
-- SAN PHAM
-- =========================================================

CREATE TABLE SanPham (
    MaSanPham INT IDENTITY PRIMARY KEY,

    MaSP VARCHAR(50) UNIQUE NOT NULL,

    Barcode VARCHAR(100) UNIQUE,

    QRCode NVARCHAR(255),

    TenSanPham NVARCHAR(200) NOT NULL,

    MaDanhMuc INT,

    MaDonVi INT,

    MoTa NVARCHAR(500),

    AnhSanPham NVARCHAR(500),

    SoLuongToiThieu INT DEFAULT 0,

    TrangThai BIT DEFAULT 1,

    IsDeleted BIT DEFAULT 0,

    CreatedAt DATETIME DEFAULT GETDATE(),

    UpdatedAt DATETIME NULL,

    FOREIGN KEY (MaDanhMuc)
    REFERENCES DanhMuc(MaDanhMuc),

    FOREIGN KEY (MaDonVi)
    REFERENCES DonViTinh(MaDonVi)
);

-- =========================================================
-- TON KHO
-- =========================================================

CREATE TABLE TonKho (
    MaKho INT NOT NULL,

    MaSanPham INT NOT NULL,

    MaViTri INT NOT NULL,

    SoLuongTon INT NOT NULL DEFAULT 0,

    NgayCapNhat DATETIME DEFAULT GETDATE(),

    PRIMARY KEY (MaKho, MaSanPham, MaViTri),

    FOREIGN KEY (MaKho)
    REFERENCES Kho(MaKho),

    FOREIGN KEY (MaSanPham)
    REFERENCES SanPham(MaSanPham),

    FOREIGN KEY (MaViTri)
    REFERENCES ViTriKho(MaViTri)
);

-- =========================================================
-- PHIEU NHAP
-- =========================================================

CREATE TABLE PhieuNhap (
    MaPhieuNhap INT IDENTITY PRIMARY KEY,

    MaPhieu VARCHAR(50) UNIQUE NOT NULL,

    NgayNhap DATETIME DEFAULT GETDATE(),

    MaNCC INT,

    MaKho INT NOT NULL,

    MaNhanVien INT NOT NULL,

    TongTien DECIMAL(18,2),

    TrangThai NVARCHAR(30)
    DEFAULT N'ChoDuyet',

    NguoiDuyet INT NULL,

    NgayDuyet DATETIME NULL,

    NgayXacNhan DATETIME NULL,

    GhiChu NVARCHAR(500),

    FOREIGN KEY (MaNCC)
    REFERENCES NhaCungCap(MaNCC),

    FOREIGN KEY (MaKho)
    REFERENCES Kho(MaKho),

    FOREIGN KEY (MaNhanVien)
    REFERENCES NhanVien(MaNhanVien),

    FOREIGN KEY (NguoiDuyet)
    REFERENCES NhanVien(MaNhanVien)
);

-- =========================================================
-- CHI TIET PHIEU NHAP
-- =========================================================

CREATE TABLE ChiTietPhieuNhap (
    MaCTPN INT IDENTITY PRIMARY KEY,

    MaPhieuNhap INT NOT NULL,

    MaSanPham INT NOT NULL,

    MaViTri INT NOT NULL,

    SoLuong INT NOT NULL,

    DonGia DECIMAL(18,2) NOT NULL,

    ThanhTien AS (SoLuong * DonGia) PERSISTED,

    GhiChu NVARCHAR(255),

    FOREIGN KEY (MaPhieuNhap)
    REFERENCES PhieuNhap(MaPhieuNhap),

    FOREIGN KEY (MaSanPham)
    REFERENCES SanPham(MaSanPham),

    FOREIGN KEY (MaViTri)
    REFERENCES ViTriKho(MaViTri),

    CONSTRAINT CK_CTPN_SoLuong
    CHECK (SoLuong > 0),

    CONSTRAINT CK_CTPN_DonGia
    CHECK (DonGia >= 0)
);

-- =========================================================
-- PHIEU XUAT
-- =========================================================

CREATE TABLE PhieuXuat (
    MaPhieuXuat INT IDENTITY PRIMARY KEY,

    MaPhieu VARCHAR(50) UNIQUE NOT NULL,

    NgayXuat DATETIME DEFAULT GETDATE(),

    MaKH INT,

    MaKho INT NOT NULL,

    MaNhanVien INT NOT NULL,

    TongTien DECIMAL(18,2),

    TrangThai NVARCHAR(30)
    DEFAULT N'ChoDuyet',

    NguoiDuyet INT,

    NgayDuyet DATETIME,

    NgayXacNhan DATETIME,

    GhiChu NVARCHAR(500),

    FOREIGN KEY (MaKH)
    REFERENCES KhachHang(MaKH),

    FOREIGN KEY (MaKho)
    REFERENCES Kho(MaKho),

    FOREIGN KEY (MaNhanVien)
    REFERENCES NhanVien(MaNhanVien),

    FOREIGN KEY (NguoiDuyet)
    REFERENCES NhanVien(MaNhanVien)
);

-- =========================================================
-- CHI TIET PHIEU XUAT
-- =========================================================

CREATE TABLE ChiTietPhieuXuat (
    MaCTPX INT IDENTITY PRIMARY KEY,

    MaPhieuXuat INT NOT NULL,

    MaSanPham INT NOT NULL,

    MaViTri INT NOT NULL,

    SoLuong INT NOT NULL,

    DonGia DECIMAL(18,2) NOT NULL,

    ThanhTien AS (SoLuong * DonGia) PERSISTED,

    FOREIGN KEY (MaPhieuXuat)
    REFERENCES PhieuXuat(MaPhieuXuat),

    FOREIGN KEY (MaSanPham)
    REFERENCES SanPham(MaSanPham),

    FOREIGN KEY (MaViTri)
    REFERENCES ViTriKho(MaViTri),

    CONSTRAINT CK_CTPX_SoLuong
    CHECK (SoLuong > 0),

    CONSTRAINT CK_CTPX_DonGia
    CHECK (DonGia >= 0)
);

-- =========================================================
-- BAO CAO SU CO
-- =========================================================

CREATE TABLE BaoCaoSuCo (
    MaBaoCao INT IDENTITY PRIMARY KEY,

    MaSanPham INT NOT NULL,

    MaViTri INT,

    LoaiSuCo NVARCHAR(50),

    SoLuong INT,

    MoTa NVARCHAR(500),

    HuongXuLy NVARCHAR(500),

    TrangThai NVARCHAR(30)
    DEFAULT N'ChoXuLy',

    MaNguoiBaoCao INT,

    MaNguoiXuLy INT,

    NgayBaoCao DATETIME DEFAULT GETDATE(),

    NgayXuLy DATETIME NULL,

    FOREIGN KEY (MaSanPham)
    REFERENCES SanPham(MaSanPham),

    FOREIGN KEY (MaViTri)
    REFERENCES ViTriKho(MaViTri),

    FOREIGN KEY (MaNguoiBaoCao)
    REFERENCES NhanVien(MaNhanVien),

    FOREIGN KEY (MaNguoiXuLy)
    REFERENCES NhanVien(MaNhanVien)
);

-- =========================================================
-- KE HOACH NHAP HANG
-- =========================================================

CREATE TABLE KeHoachNhapHang (
    MaKeHoach INT IDENTITY PRIMARY KEY,

    MaSanPham INT NOT NULL,

    MaNCC INT,

    SoLuongDuKien INT NOT NULL,

    NgayDuKien DATE NOT NULL,

    TrangThai NVARCHAR(30)
    DEFAULT N'DaLap',

    GhiChu NVARCHAR(500),

    MaNguoiLap INT,

    NgayTao DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (MaSanPham)
    REFERENCES SanPham(MaSanPham),

    FOREIGN KEY (MaNCC)
    REFERENCES NhaCungCap(MaNCC),

    FOREIGN KEY (MaNguoiLap)
    REFERENCES NhanVien(MaNhanVien)
);

-- =========================================================
-- THONG BAO
-- =========================================================

CREATE TABLE ThongBao (
    MaThongBao INT IDENTITY PRIMARY KEY,

    TieuDe NVARCHAR(255),

    NoiDung NVARCHAR(MAX),

    LoaiThongBao NVARCHAR(50),

    DaDoc BIT DEFAULT 0,

    MaNguoiNhan INT,

    NgayTao DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (MaNguoiNhan)
    REFERENCES NhanVien(MaNhanVien)
);

-- =========================================================
-- FILE DINH KEM
-- =========================================================

CREATE TABLE TepTin (
    MaFile INT IDENTITY PRIMARY KEY,

    TenFile NVARCHAR(255),

    DuongDan NVARCHAR(500),

    LoaiFile NVARCHAR(50),

    KichThuoc BIGINT,

    MaNhanVien INT,

    NgayTaiLen DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (MaNhanVien)
    REFERENCES NhanVien(MaNhanVien)
);

-- =========================================================
-- LICH SU THAO TAC
-- =========================================================

CREATE TABLE LichSuThaoTac (
    MaLichSu INT IDENTITY PRIMARY KEY,

    MaNhanVien INT,

    HanhDong NVARCHAR(100),

    BangTacDong NVARCHAR(100),

    MaBanGhi INT,

    NoiDungCu NVARCHAR(MAX),

    NoiDungMoi NVARCHAR(MAX),

    DiaChiIP VARCHAR(50),

    ThoiGian DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (MaNhanVien)
    REFERENCES NhanVien(MaNhanVien)
);

-- =========================================================
-- CAU HINH HE THONG
-- =========================================================

CREATE TABLE CauHinhHeThong (
    MaCauHinh INT IDENTITY PRIMARY KEY,

    KhoaCauHinh VARCHAR(100) UNIQUE,

    GiaTri NVARCHAR(500),

    MoTa NVARCHAR(255),

    NgayCapNhat DATETIME DEFAULT GETDATE()
);

-- =========================================================
-- NHAT KY SAO LUU
-- =========================================================

CREATE TABLE NhatKySaoLuu (
    MaSaoLuu INT IDENTITY PRIMARY KEY,

    TenFile NVARCHAR(255),

    LoaiSaoLuu NVARCHAR(50),

    TrangThai NVARCHAR(30),

    NgaySaoLuu DATETIME DEFAULT GETDATE(),

    MaNhanVien INT,

    FOREIGN KEY (MaNhanVien)
    REFERENCES NhanVien(MaNhanVien)
);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IX_SanPham_TenSanPham
ON SanPham(TenSanPham);

CREATE INDEX IX_TonKho_MaSanPham
ON TonKho(MaSanPham);

CREATE INDEX IX_PhieuNhap_TrangThai
ON PhieuNhap(TrangThai);

CREATE INDEX IX_PhieuXuat_TrangThai
ON PhieuXuat(TrangThai);

CREATE INDEX IX_LichSu_ThoiGian
ON LichSuThaoTac(ThoiGian);

-- =========================================================
-- VIEW DASHBOARD KPI
-- =========================================================

GO

CREATE VIEW v_DashboardKPI
AS
SELECT
    (SELECT COUNT(*) FROM SanPham WHERE IsDeleted = 0) AS TongSanPham,

    (SELECT ISNULL(SUM(SoLuongTon),0)
     FROM TonKho) AS TongTonKho,

    (SELECT COUNT(*)
     FROM PhieuNhap
     WHERE TrangThai = N'ChoDuyet') AS PhieuNhapChoDuyet,

    (SELECT COUNT(*)
     FROM PhieuXuat
     WHERE TrangThai = N'ChoDuyet') AS PhieuXuatChoDuyet,

    (SELECT COUNT(*)
     FROM BaoCaoSuCo
     WHERE TrangThai = N'ChoXuLy') AS SuCoChoXuLy;

GO

-- =========================================================
-- STORED PROCEDURE NHAP KHO
-- =========================================================

CREATE OR ALTER PROCEDURE sp_XacNhanNhapKho
    @MaPhieuNhap INT
AS
BEGIN
    BEGIN TRANSACTION

    BEGIN TRY

        DECLARE @MaKho INT

        SELECT @MaKho = MaKho
        FROM PhieuNhap
        WHERE MaPhieuNhap = @MaPhieuNhap

        UPDATE tk
        SET
            tk.SoLuongTon = tk.SoLuongTon + ct.SoLuong,
            tk.NgayCapNhat = GETDATE()

        FROM TonKho tk

        JOIN ChiTietPhieuNhap ct
        ON tk.MaKho = @MaKho
        AND tk.MaSanPham = ct.MaSanPham
        AND tk.MaViTri = ct.MaViTri

        WHERE ct.MaPhieuNhap = @MaPhieuNhap

        COMMIT
    END TRY

    BEGIN CATCH
        ROLLBACK
    END CATCH
END

GO

-- =========================================================
-- SEED DATA
-- =========================================================

INSERT INTO VaiTro(TenVaiTro)
VALUES
(N'Admin'),
(N'QuanLy'),
(N'NhanVien');

INSERT INTO DonViTinh(TenDonVi)
VALUES
(N'kg'),
(N'lít'),
(N'thùng'),
(N'cái');

INSERT INTO Kho(TenKho)
VALUES
(N'Kho Chính');

INSERT INTO DanhMuc(TenDanhMuc)
VALUES
(N'Hóa Chất'),
(N'Vật Tư');

PRINT N'======================================';
PRINT N'QUAN LY KHO DATABASE CREATED SUCCESS';
PRINT N'======================================';



CREATE TABLE BaoHanhSanPham (
    MaBaoHanh INT IDENTITY PRIMARY KEY,
    MaSanPham INT NOT NULL,
    MaKho INT NOT NULL,
    MaNCC INT NULL,
    MaViTri INT NULL,
    SoSerial VARCHAR(100) NULL,
    SoLo VARCHAR(100) NULL,
    NgayNhapKho DATE NULL,
    HanBaoHanh DATE NULL,
    NgayBaoHanh DATE NULL,
    LoaiBaoHanh NVARCHAR(100) NULL,
    TinhTrangLoi NVARCHAR(500) NULL,
    HuongXuLy NVARCHAR(500) NULL,
    SoLuong INT NOT NULL DEFAULT 1,
    TrangThai NVARCHAR(50) DEFAULT N'ChoBaoHanh',
    MaNhanVienBaoHanh INT NULL,
    GhiChu NVARCHAR(500) NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,

    FOREIGN KEY (MaSanPham) REFERENCES SanPham(MaSanPham),
    FOREIGN KEY (MaKho) REFERENCES Kho(MaKho),
    FOREIGN KEY (MaNCC) REFERENCES NhaCungCap(MaNCC),
    FOREIGN KEY (MaViTri) REFERENCES ViTriKho(MaViTri),
    FOREIGN KEY (MaNhanVienBaoHanh) REFERENCES NhanVien(MaNhanVien)
);

-- Thêm cột CachQuanLy để phân loại cách thức chạy bảo hành và quản lý kho
ALTER TABLE [dbo].[SanPham] 
ADD [CachQuanLy] NVARCHAR(50) DEFAULT 'SOLO';
GO

SELECT * FROM dbo.BaoHanhSanPham 
WHERE SoSerial = @search