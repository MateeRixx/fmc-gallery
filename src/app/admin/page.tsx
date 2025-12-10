// src/app/admin/page.tsx
import AdminForm from "@/components/AdminForm";

export default function Admin() {
  return (
    <div className="min-h-screen bg-black text-white py-20">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h1 className="text-7xl font-black mb-8 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          SECRET ADMIN PANEL
        </h1>
        <p className="text-xl text-gray-400 mb-12">Only you can see this. Add events → they appear instantly.</p>
        <AdminForm />
      </div>
    </div>
  );
}