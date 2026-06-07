export const products = [
  { id: 1, code: "HC001", name: "Hóa chất A", category: "Hóa Chất", unit: "kg", quantity: 12, minQuantity: 20, location: "K01-A1", status: "Sắp hết" },
  { id: 2, code: "VT002", name: "Dụng cụ B", category: "Vật Tư", unit: "cái", quantity: 85, minQuantity: 30, location: "K02-B2", status: "Ổn định" },
  { id: 3, code: "HC003", name: "Hóa chất C", category: "Hóa Chất", unit: "lít", quantity: 7, minQuantity: 25, location: "K03-C1", status: "Sắp hết" },
];

export const importReceipts = [
  { id: "PN000123", supplier: "Công ty ABC", date: "22/05/2024", total: "12,500,000đ", status: "Chờ duyệt" },
  { id: "PN000124", supplier: "Công ty DEF", date: "22/05/2024", total: "8,200,000đ", status: "Đã duyệt" },
];

export const exportReceipts = [
  { id: "PX000456", customer: "Khách hàng A", date: "22/05/2024", total: "7,800,000đ", status: "Chờ duyệt" },
  { id: "PX000457", customer: "Khách hàng B", date: "21/05/2024", total: "5,400,000đ", status: "Đã xuất" },
];

export const incidents = [
  { id: "BC001", product: "Hóa chất A", type: "Hàng hỏng", quantity: 3, status: "Chờ xử lý" },
  { id: "BC002", product: "Dụng cụ B", type: "Thiếu hàng", quantity: 5, status: "Đang xử lý" },
];

export const activityLogs = [
  { id: 1, user: "Khim", action: "Xác nhận phiếu nhập PN000123", time: "22/05/2024 10:30" },
  { id: 2, user: "Trần Thị B", action: "Cập nhật tồn kho Hóa chất A", time: "22/05/2024 09:15" },
];

export const users = [
  { id: 1, name: "Khim", email: "staff@gmail.com", role: "NhanVien", status: "Hoạt động" },
  { id: 2, name: "Trần Thị B", email: "manager@gmail.com", role: "QuanLy", status: "Hoạt động" },
  { id: 3, name: "Admin", email: "admin@gmail.com", role: "Admin", status: "Hoạt động" },
];

export const categories = [
  { id: 1, name: "Hóa Chất", description: "Nhóm sản phẩm hóa chất", status: "Hoạt động" },
  { id: 2, name: "Vật Tư", description: "Nhóm vật tư kho", status: "Hoạt động" },
];
