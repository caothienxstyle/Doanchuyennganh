export default function StatusBadge({ status }) {
  let className = "bg-green-50 text-green-600";

  if (status === "Sắp hết" || status === "Chờ xử lý" || status === "Hàng hỏng") {
    className = "bg-red-50 text-red-600";
  }

  if (status === "Chờ duyệt" || status === "Đang xử lý" || status === "Sắp nhập") {
    className = "bg-orange-50 text-orange-600";
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
}
