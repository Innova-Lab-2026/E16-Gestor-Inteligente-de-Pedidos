"use client";

type EmptyStateProps = {
  titulo: string;
  descripcion: string;
  textoBoton?: string;
  onAccion?: () => void;
};

export default function EmptyState({
  titulo,
  descripcion,
  textoBoton,
  onAccion,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <h2 className="text-lg font-bold text-[#102a39]">{titulo}</h2>
      <p className="mt-2 max-w-xs text-sm text-[#586574]">{descripcion}</p>
      {textoBoton && onAccion && (
        <button
          type="button"
          onClick={onAccion}
          className="mt-6 rounded-full bg-[#056184] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#044d69]"
        >
          {textoBoton}
        </button>
      )}
    </div>
  );
}
