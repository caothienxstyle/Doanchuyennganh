import api from "./api";

// Hàm bổ trợ lấy token tự động
const getAuthHeaders = () => {
  const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

function getFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function normalizeText(value, fallback = "—") {
  if (typeof value === "boolean") return fallback;
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function extractProducts(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.products)) return payload.data.products;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.records)) return payload.records;
  return [];
}

function normalizeProduct(product = {}) {
  const raw = product?.data ?? product?.item ?? product?.result ?? product?.record ?? product;
  const nested = raw?.product ?? raw?.sanPham ?? raw?.sp ?? raw?.item ?? raw?.record ?? raw?.detail ?? {};
  const resolvedProduct = {
    ...(raw && typeof raw === "object" ? raw : {}),
    ...(nested && typeof nested === "object" ? nested : {}),
  };

  const categoryObj = resolvedProduct?.DanhMuc ?? resolvedProduct?.category ?? resolvedProduct?.danhMuc ?? {};
  const unitObj = resolvedProduct?.DonViTinh ?? resolvedProduct?.unit ?? resolvedProduct?.donViTinh ?? {};

  const quantity = getFirstDefined(
    resolvedProduct.quantity, resolvedProduct.TonKho, resolvedProduct.stock,
    resolvedProduct.SoLuong, resolvedProduct.soLuong, resolvedProduct.quantityInStock,
    resolvedProduct.tonKho, resolvedProduct.soluong, resolvedProduct.SL,
    resolvedProduct.SoLuongHienTai, resolvedProduct.soLuongHienTai, resolvedProduct.currentQuantity,
    resolvedProduct.soLuongTonKho
  );

  const status = getFirstDefined(
    resolvedProduct.status, resolvedProduct.TrangThai, resolvedProduct.state,
    resolvedProduct.trangThai, resolvedProduct.tinhTrang, resolvedProduct.statusName,
    resolvedProduct.trang_thai
  );

  const categoryName = getFirstDefined(
    categoryObj.TenDanhMuc, categoryObj.tenDanhMuc, categoryObj.name,
    resolvedProduct.TenDanhMuc, resolvedProduct.categoryName, resolvedProduct.DanhMuc,
    resolvedProduct.LoaiSP, resolvedProduct.loaiSP, resolvedProduct.Loai,
    resolvedProduct.categoryCode, resolvedProduct.tenDanhMuc
  );

  const unitName = getFirstDefined(
    unitObj.TenDonVi, unitObj.tenDonVi, unitObj.name,
    resolvedProduct.TenDonVi, resolvedProduct.tenDonVi, resolvedProduct.DonVi,
    resolvedProduct.unitName, resolvedProduct.DVT, resolvedProduct.donVi,
    resolvedProduct.dvt
  );

  return {
    id: getFirstDefined(
      resolvedProduct.id, resolvedProduct.MaSanPham, resolvedProduct.MaSP,
      resolvedProduct.maSP, resolvedProduct.code, resolvedProduct.productId,
      resolvedProduct.productCode, resolvedProduct.MASP
    ),
    code: getFirstDefined(
      resolvedProduct.code, resolvedProduct.MaSP, resolvedProduct.maSP,
      resolvedProduct.productCode, resolvedProduct.SPCode, resolvedProduct.MASP
    ),
    name: normalizeText(
      getFirstDefined(
        resolvedProduct.name, resolvedProduct.TenSP, resolvedProduct.tenSP,
        resolvedProduct.productName, resolvedProduct.tenSanPham, resolvedProduct.TenSanPham,
        resolvedProduct.ten_san_pham, resolvedProduct.assetName
      ),
      "Chưa cập nhật"
    ),
    category: normalizeText(categoryName, "Chưa phân loại"),
    categoryId: getFirstDefined(
      resolvedProduct.MaDanhMuc, categoryObj.MaDanhMuc, categoryObj.maDanhMuc,
      resolvedProduct.categoryId, resolvedProduct.category_id, resolvedProduct?.category?.MaDanhMuc
    ),
    unit: normalizeText(unitName, "—"),
    unitId: getFirstDefined(
      resolvedProduct.MaDonVi, unitObj.MaDonVi, unitObj.maDonVi,
      resolvedProduct.unitId, resolvedProduct.unit_id
    ),
    description: normalizeText(
      getFirstDefined(resolvedProduct.description, resolvedProduct.MoTa, resolvedProduct.moTa, resolvedProduct.desc),
      "—"
    ),
    image: normalizeText(
      getFirstDefined(resolvedProduct.image, resolvedProduct.AnhSanPham, resolvedProduct.anhSanPham, resolvedProduct.avatar),
      ""
    ),
    minQuantity: getFirstDefined(
      resolvedProduct.minQuantity, resolvedProduct.SoLuongToiThieu,
      resolvedProduct.soLuongToiThieu, resolvedProduct.minimumQuantity
    ),
    quantity: normalizeText(quantity !== undefined ? Number(quantity) : undefined, "0"),
    status: normalizeText(status, "Ổn định"),
    barcode: normalizeText(getFirstDefined(resolvedProduct.barcode, resolvedProduct.Barcode, resolvedProduct.barCode), ""),
    qrCode: normalizeText(getFirstDefined(resolvedProduct.qrCode, resolvedProduct.QRCode, resolvedProduct.qr_code), ""),
    isDeleted: getFirstDefined(resolvedProduct.isDeleted, resolvedProduct.IsDeleted),
  };
}

export async function getProducts() {
  const response = await api.get("/products/danhsachsanpham", getAuthHeaders());
  const items = extractProducts(response.data);
  return items.map(normalizeProduct);
}

export async function getLowStockProducts() {
  const response = await api.get("/products/low-stock", getAuthHeaders());
  const items = extractProducts(response.data);
  return items.map(normalizeProduct);
}

export async function getProductById(id) {
  const response = await api.get(`/products/${id}`, getAuthHeaders());
  const payload = response.data?.data ?? response.data;
  return normalizeProduct(payload);
}

export async function createProduct(payload) {
  const response = await api.post("/products/taosanpham", payload, getAuthHeaders());
  return response.data;
}

export async function updateProduct(payload) {
  const response = await api.put("/products/capnhatsanpham", payload, getAuthHeaders());
  return response.data;
}

export async function deleteProduct(maSpOrObject) {
  const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
  
  // Kiểm tra nếu giao diện truyền vào object { MaSP: "..." } thì bóc tách lấy chuỗi ra
  const finalMaSP = typeof maSpOrObject === "object" && maSpOrObject !== null
    ? maSpOrObject.MaSP
    : maSpOrObject;

  const payload = { MaSP: String(finalMaSP || "").trim() };

  const response = await api.delete("/products/xoasanpham", {
    headers: { 
      Authorization: `Bearer ${token}`, 
      "Content-Type": "application/json" 
    },
    data: payload 
  });
  
  return response.data;
}