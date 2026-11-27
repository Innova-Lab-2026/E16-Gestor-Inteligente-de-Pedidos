export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center gap-3 px-5 text-[#102a39]">
      <div
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-4 border-[#82f8e7] border-t-[#7622ed]"
      />
      <p className="text-sm font-semibold">Cargando…</p>
      <p className="text-center text-xs text-[#64748b]">
        La primera carga puede tardar unos segundos.
      </p>
    </div>
  );
}
