import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getSession } from "@/features/auth/session";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/router";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    if (await getSession()) redirect(ROUTES.home)
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}