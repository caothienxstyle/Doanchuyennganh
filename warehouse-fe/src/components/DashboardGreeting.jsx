import { getCurrentUser, ROLES } from "../services/auth";

export default function DashboardGreeting({
  role = ROLES.staff,
  description,
}) {
  const user = getCurrentUser(role);

  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold">Xin chào, {user.userName}! 👋</h2>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}
