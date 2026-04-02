import { Sidebar } from "@/components/dashboard/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-[#FBFBFB]">
      <Sidebar />
      <main className="flex-1 pl-16">
        {children}
      </main>
    </div>
  );
}
