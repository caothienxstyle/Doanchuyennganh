export default function StatCard({ title, value, note, icon: Icon, color = "blue" }) {
  const colors = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    orange: "bg-orange-100 text-orange-600",
    red: "bg-red-100 text-red-600",
    purple: "bg-purple-100 text-purple-600",
    cyan: "bg-cyan-100 text-cyan-600",
  };

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <h3 className="mt-2 text-2xl font-bold">{value}</h3>
          <p className="mt-1 text-xs text-green-600">{note}</p>
        </div>

        {Icon && (
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${colors[color]}`}>
            <Icon size={24} />
          </div>
        )}
      </div>
    </div>
  );
}
