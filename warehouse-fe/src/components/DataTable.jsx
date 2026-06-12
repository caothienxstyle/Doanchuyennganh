export default function DataTable({ columns, data }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="min-w-[980px] w-full text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left align-top font-medium whitespace-nowrap ${col.headerClassName || ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {data.map((row, index) => (
            <tr key={row.id || index} className="align-top hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 align-top ${col.className || ""}`}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
