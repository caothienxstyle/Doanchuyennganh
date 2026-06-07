import MainLayout from "../layouts/MainLayout";

export default function PlaceholderPage({ title, description }) {
  return (
    <MainLayout>
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-blue-600">Chức năng theo quyền</p>
        <h2 className="mt-2 text-2xl font-bold">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-gray-500">
          {description || "Màn hình này đã được mở đúng theo role hiện tại và sẵn sàng để bổ sung nghiệp vụ chi tiết."}
        </p>
      </div>
    </MainLayout>
  );
}
