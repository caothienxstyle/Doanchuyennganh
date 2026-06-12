import axios from "axios";

const API = "http://localhost:3000";

function getAuthHeaders() {
  const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
  return { Authorization: `Bearer ${token}` };
}

export const getProfile = async () => {
  const res = await axios.get(`${API}/auth/me`, {
    headers: getAuthHeaders(),
  });
  return res.data;
};

export const uploadAvatar = async (file) => {
  if (!file) throw new Error("Vui lòng chọn ảnh trước khi tải lên.");

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const formData = new FormData();

  formData.append("TenNhanVien", user.TenNhanVien || "");
  formData.append("NgaySinh", user.NgaySinh || "");
  formData.append("GioiTinh", user.GioiTinh ? 1 : 0);
  formData.append("SDT", user.SDT || "");
  formData.append("Email", user.Email || "");
  formData.append("CCCD", user.CCCD || "");
  formData.append("DiaChi", user.DiaChi || "");
  formData.append("TrangThai", (user.TrangThaiTaiKhoan === true || Number(user.TrangThaiTaiKhoan) === 1) ? 1 : 0);
  formData.append("AnhDaiDien", file);

  const config = {
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "multipart/form-data",
    },
  };

  if (!user?.MaNhanVien) {
    throw new Error("Không tìm thấy mã nhân viên để cập nhật ảnh đại diện.");
  }

  const res = await axios.put(`${API}/nhanvien/capnhat/${user.MaNhanVien}`, formData, config);
  return res.data;
};