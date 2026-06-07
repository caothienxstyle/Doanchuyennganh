export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#f3f6fb] flex items-center justify-center p-6">
      {children}
    </div>
  );
}
