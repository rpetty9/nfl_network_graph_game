import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import HomePage from "@/app/page";

export default async function TestingPage() {
  const session = await auth();
  if (!isAdminSession(session)) {
    redirect("/");
  }

  return <HomePage />;
}
