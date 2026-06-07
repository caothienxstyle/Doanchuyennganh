import MainLayout from "../layouts/MainLayout";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { incidents } from "../data/mockData";

export default function IncidentPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Báo cáo sự cố</h2>
          <p className="text-sm text-gray-500">Báo cáo hàng hư hỏng, thiếu hoặc vấn đề phát sinh</p>
        </div>
        <button className="rounded-xl bg-blue-600 px-4 py-2 text-white text-sm">+ Tạo báo cáo</button>
      </div>

      <DataTable
        columns={[
          { key: "id", label: "Mã báo cáo" },
          { key: "product", label: "Sản phẩm" },
          { key: "type", label: "Loại sự cố" },
          { key: "quantity", label: "Số lượng" },
          { key: "status", label: "Trạng thái", render: (value) => <StatusBadge status={value} /> },
        ]}
        data={incidents}
      />
    </MainLayout>
  );
}
