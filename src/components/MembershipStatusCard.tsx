"use client";

import { useSession } from "next-auth/react";

const ROLE_INFO = {
  0: { name: "VISITOR", label: "Visitor", color: "gray", icon: "👤" },
  1: { name: "EXECUTIVE", label: "Executive", color: "blue", icon: "📋" },
  2: { name: "CO_HEAD", label: "Co-Head", color: "orange", icon: "🤝" },
  3: { name: "HEAD", label: "Head", color: "red", icon: "👑" },
};

export default function MembershipStatusCard() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  const roleLevel = (session.user as any)?.roleLevel ?? 0;
  const roleName = (session.user as any)?.roleName ?? "VISITOR";
  const isActive = (session.user as any)?.isActive ?? false;
  const isMaster = (session.user as any)?.isMaster ?? false;

  const roleInfo = ROLE_INFO[roleLevel as keyof typeof ROLE_INFO] || ROLE_INFO[0];

  const colorClasses: Record<string, string> = {
    gray: "bg-gray-900 border-gray-700 text-gray-200",
    blue: "bg-blue-900 border-blue-700 text-blue-200",
    orange: "bg-orange-900 border-orange-700 text-orange-200",
    red: "bg-red-900 border-red-700 text-red-200",
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[roleInfo.color]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{roleInfo.icon}</span>
          <div>
            <p className="font-bold text-white">{roleInfo.label}</p>
            <p className="text-xs opacity-80">
              {isActive ? "✓ Active Member" : "✗ Inactive"}
              {isMaster && " • Master Admin"}
            </p>
          </div>
        </div>
        {roleLevel >= 2 && (
          <div className="text-right text-xs">
            <p className="opacity-75">Admin Access</p>
            <p className="opacity-75">Level {roleLevel}</p>
          </div>
        )}
      </div>

      {!isActive && (
        <div className="mt-3 p-3 rounded bg-red-950 border border-red-700 text-red-200 text-xs">
          ⚠️ Your membership is inactive. Contact your HEAD for reactivation.
        </div>
      )}
    </div>
  );
}
