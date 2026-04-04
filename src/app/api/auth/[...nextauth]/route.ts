import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Validate that at least one provider is configured
if (!authOptions.providers || authOptions.providers.length === 0) {
  console.error(
    "🔴 NextAuth Error: No providers configured. Check your environment variables."
  );
  console.error("   Required: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET, OR RESEND_API_KEY");
}

console.log(
  `✓ NextAuth initialized with ${authOptions.providers?.length || 0} provider(s)`
);

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
