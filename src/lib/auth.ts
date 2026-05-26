import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { MASTER_EMAIL } from "./config";
import {
  getUserMembership,
  getUserRoleLevel,
  ROLE_LEVEL_NAMES,
} from "./membership-utils";

export const authOptions: NextAuthOptions = {
  providers: [
    // Credentials provider for OTP-based authentication
    CredentialsProvider({
      name: "OTP",
      credentials: {
        email: { label: "Email", type: "text" },
        userId: { label: "User ID", type: "text" },
      },
      async authorize(credentials) {
        // This callback is called after OTP verification
        // The frontend will have already verified the OTP and obtained userId
        if (!credentials?.email || !credentials?.userId) {
          return null;
        }

        const supabase = getSupabaseAdmin();

        // Fetch user from database
        const { data: user, error } = await supabase
          .from("users")
          .select("id, email, full_name")
          .eq("id", credentials.userId)
          .maybeSingle();

        if (error || !user) {
          console.error("Error fetching user:", error);
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.full_name || user.email.split("@")[0],
        };
      },
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async jwt({ token, user }) {
      try {
        if (user) {
          // After successful OTP verification
          token.userId = user.id;
          token.email = user.email;
          token.fullName = user.name || user.email.split("@")[0];
        }

        // Always refresh role from membrane on each token call
        if (token.userId) {
          const membership = await getUserMembership(token.userId as string);
          const roleLevel = await getUserRoleLevel(token.userId as string);
          
          const supabase = getSupabaseAdmin();
          const { data: userRec } = await supabase
            .from("users")
            .select("role, permissions")
            .eq("id", token.userId)
            .single();

          token.roleLevel = roleLevel;
          token.roleName = ROLE_LEVEL_NAMES[roleLevel];
          token.role = userRec?.role || (ROLE_LEVEL_NAMES[roleLevel] || "VISITOR").toLowerCase();
          token.permissions = userRec?.permissions || [];
          token.isActive = membership?.is_active ?? false;
          token.isMaster = (token.email as string)?.toLowerCase() === MASTER_EMAIL.toLowerCase();
        }

        return token;
      } catch (error) {
        console.error("JWT callback error:", error);
        return token;
      }
    },

    async session({ session, token }) {
      // Add membership info to session
      try {
        if (session.user && token) {
          session.user.id = (token.userId as string) || "";
          session.user.roleLevel = (token.roleLevel as number) || 0;
          session.user.roleName = (token.roleName as string) || "VISITOR";
          session.user.role = (token.role as string) || "visitor";
          session.user.permissions = (token.permissions as string[]) || [];
          session.user.isActive = (token.isActive as boolean) || false;
          session.user.isMaster = (token.isMaster as boolean) || false;
        }
      } catch (error) {
        console.error("Error in session callback:", error);
      }

      return session;
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 4 * 60 * 60, // 4 hours 
  },

  secret: process.env.NEXTAUTH_SECRET,
};
