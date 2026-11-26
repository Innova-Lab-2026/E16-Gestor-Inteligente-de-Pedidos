"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-3xl font-bold text-[#102a39]">Algo salió mal</h1>
      <p className="mt-4 max-w-sm text-sm text-[#586574]">
        Ocurrió un error inesperado al cargar esta pantalla. Podés intentar de
        nuevo.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-11 rounded-full bg-[#7622ed] px-6 text-sm font-bold text-white transition hover:bg-[#6018c7]"
      >
        Reintentar
      </button>
      <Link href="/" className="mt-4 underline">
        Volver al inicio
      </Link>
    </div>
  );
}
