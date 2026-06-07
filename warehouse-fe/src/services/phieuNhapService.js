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

export const getAllPhieuNhap = async () => {
  const res = await api.get("/phieunhap/danhsach", getAuthHeaders());
  return res.data;
};

export const createPhieuNhap = async (payload) => {
  const res = await api.post("/phieunhap/taophieunhap", payload, getAuthHeaders());
  return res.data;
};

export const updatePhieuNhap = async (payload) => {
  const res = await api.put("/phieunhap/capnhat", payload, getAuthHeaders());
  return res.data;
};

export const approvePhieuNhap = async (payload) => {
  const res = await api.put("/phieunhap/duyetphieu", payload, getAuthHeaders());
  return res.data;
};

export const getChiTietPhieuNhap = async (id) => {
  const res = await api.get(`/phieunhap/chitiet/${id}`, getAuthHeaders());
  return res.data;
};