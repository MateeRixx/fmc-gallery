// src/app/admin/page.tsx
// src/app/admin/page.tsx
import AdminForm from "@/components/AdminForm";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-20">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-6xl md:text-8xl font-black text-center text-white mb-4">
          ADMIN PANEL
        </h1>
        <p className="text-center text-gray-300 mb-12 text-xl">
          Add new events — they appear instantly on the site
        </p>
        <AdminForm />
      </div>
    </div>
  );
}