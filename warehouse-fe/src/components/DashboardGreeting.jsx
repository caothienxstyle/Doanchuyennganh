import { getCurrentUser, ROLES } from "../services/auth";

export default function DashboardGreeting({
  role = ROLES.staff,
  userName,
  description,
}) {
  const user = getCurrentUser(role);
  const displayName = userName || user.userName;

  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-gray-800">Xin chào, {displayName}! 👋</h2>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}
