import { redirect } from "next/navigation";
import { ROUTES } from "@/config/router";

export default function LoginPage() {
  redirect(ROUTES.login);
}
