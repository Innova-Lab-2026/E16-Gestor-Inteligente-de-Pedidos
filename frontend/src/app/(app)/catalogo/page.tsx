import { getProductos } from "@/app/(app)/catalogo/api";
import CatalogoList from "@/app/(app)/catalogo/components/CatalogoList";

export default async function CatalogoPage() {
  const { data, error } = await getProductos(true);

  return (
    <section className="space-y-4 pt-2">
      <div>
        <h1 className="text-2xl font-bold text-[#102a39]">Catálogo</h1>
        <p className="text-sm text-[#586574]">
          Listado de productos. Controlá precios y stock.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      ) : (
        <CatalogoList productos={data ?? []} />
      )}
    </section>
  );
}