import api from "./api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  };
};

function extractTonKho(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.tonKho)) return payload.tonKho;
  if (Array.isArray(payload?.tonkho)) return payload.tonkho;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

export function normalizeTonKhoItem(item = {}) {
  const raw = item?.data ?? item?.item ?? item?.record ?? item;
  const nested = raw?.tonKho ?? raw?.tonkho ?? raw?.inventory ?? raw?.detail ?? {};
  const resolved = {
    ...(raw && typeof raw === "object" ? raw : {}),
    ...(nested && typeof nested === "object" ? nested : {}),
  };

  return {
    MaSanPham: resolved.MaSanPham ?? resolved.maSanPham ?? resolved.productId ?? resolved.id,
    SoLuongTon: Number(resolved.SoLuongTon ?? resolved.soLuongTon ?? resolved.quantity ?? resolved.stock ?? 0)
  };
}

export async function getTonKhoItems() {
  const response = await api.get("/tonkho", getAuthHeaders());
  return extractTonKho(response.data);
}

export async function getTonKho() {
  const items = await getTonKhoItems();
  return items.map(normalizeTonKhoItem);
}

export function mergeProductsWithTonKho(products = [], normalizedTonKho = []) {
  return products.map((product) => {
    const currentProductId = product.id || product.MaSanPham;
    const totalStock = normalizedTonKho.reduce((sum, stockItem) => {
      if (stockItem.MaSanPham == currentProductId) {
        return sum + (stockItem.SoLuongTon || 0);
      }
      return sum;
    }, 0);

    return {
      ...product,
      SoLuongTon: totalStock
    };
  });
}

export async function createTonKhoItem(payload) {
  const response = await api.post("/tonkho/taotonkho", payload, getAuthHeaders());
  return response.data;
}

export async function updateTonKhoItem(payload) {
  const response = await api.put("/tonkho/capnhattonkho", payload, getAuthHeaders());
  return response.data;
}

export async function deleteTonKhoItem(payload) {
  const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
  const response = await api.delete("/tonkho/xoatonkho", {
    headers: { Authorization: `Bearer ${token}` },
    data: payload
  });
  return response.data;
}