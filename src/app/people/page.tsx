import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Redirecting... - FMC Gallery",
};

export default async function PeoplePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Automatically redirect the old `/people` route to the newer visitor dashboard.
  redirect("/visitor/moments");
}
