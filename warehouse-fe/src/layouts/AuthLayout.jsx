export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen w-full bg-[#f3f4f6] flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans">
      <div className="w-full max-w-[1200px] bg-white rounded-[32px] shadow-[0_24px_70px_rgba(0,0,0,0.07)] overflow-hidden flex flex-col md:flex-row md:aspect-[1.5] lg:aspect-[16/10] min-h-[550px] md:min-h-[680px]">
        {children}
      </div>
    </div>
  );
}

