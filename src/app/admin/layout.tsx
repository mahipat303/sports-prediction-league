import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Shield } from "lucide-react";
import { AdminNav } from "@/components/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <Link href="/" className="ml-auto text-sm text-primary hover:underline">
          ← Back to app
        </Link>
      </div>
      <AdminNav />
      {children}
    </div>
  );
}
