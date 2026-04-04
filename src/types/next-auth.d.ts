// TypeScript module augmentation for NextAuth
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      userType: "ADMIN" | "VISITOR";
      role: string | null;
      fullName: string;
      permissions: string[];
      isMaster: boolean;
      roleLevel?: number;
      roleName?: string;
      isActive?: boolean;
    };
  }

  interface User {
    id?: string;
    email: string;
    name?: string | null;
    image?: string | null;
    userType?: "ADMIN" | "VISITOR";
    role?: string | null;
    permissions?: string[];
    isMaster?: boolean;
    roleLevel?: number;
    roleName?: string;
    isActive?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    userType?: "ADMIN" | "VISITOR";
    role?: string | null;
    fullName?: string;
    email?: string;
    accessToken?: string;
    permissions?: string[];
    isMaster?: boolean;
    roleLevel?: number;
    roleName?: string;
    isActive?: boolean;
  }
}
