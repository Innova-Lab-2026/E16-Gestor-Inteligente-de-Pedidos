import { redirect } from "next/navigation";
import { ROUTES } from "@/config/router";

type LoginPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const registered = params.registered;

  if (registered === "1" || registered === "pending") {
    redirect(`${ROUTES.login}?registered=${registered}`);
  }

  redirect(ROUTES.login);
}
