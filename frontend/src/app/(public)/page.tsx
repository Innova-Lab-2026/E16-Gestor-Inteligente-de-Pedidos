import LoginScreen from "@/components/auth/LoginScreen";

type HomeProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const registered = params.registered;
  const registrationNotice =
    registered === "1" || registered === "pending" ? registered : null;

  return <LoginScreen registrationNotice={registrationNotice} />;
}
