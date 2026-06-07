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

// 1. Lấy danh sách nhà cung cấp
export async function getNhaCungCapList() {
  const response = await api.get("/nhacungcap/danhsach", getAuthHeaders());
  return response.data?.data || [];
}

// 2. Xem chi tiết nhà cung cấp theo ID
export async function getDetailNhaCungCap(id) {
  const response = await api.get(`/nhacungcap/chitiet/${id}`, getAuthHeaders());
  return response.data?.data;
}

// 3. Tạo mới nhà cung cấp
export async function createNhaCungCap(payload) {
  const response = await api.post("/nhacungcap/taomoi", payload, getAuthHeaders());
  return response.data;
}

// 4. Cập nhật thông tin nhà cung cấp
export async function updateNhaCungCap(payload) {
  const response = await api.put("/nhacungcap/capnhat", payload, getAuthHeaders());
  return response.data;
}

// 5. Xóa mềm nhà cung cấp (Truyền ID qua URL giống Backend định nghĩa /xoa/:id)
export async function deleteNhaCungCap(id) {
  const response = await api.delete(`/nhacungcap/xoa/${id}`, getAuthHeaders());
  return response.data;
}