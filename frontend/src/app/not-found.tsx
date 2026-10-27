import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="mt-4 text-lg">La página que buscás no existe.</p>
      <Link href="/" className="mt-6 underline">
        Volver al inicio
      </Link>
    </div>
  );
}