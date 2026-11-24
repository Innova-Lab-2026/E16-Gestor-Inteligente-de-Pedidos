import Link from "next/link";
import { getProductos } from "@/app/(app)/catalogo/api";
import { getDashboardResumen } from "./api";
import type { EstadoPedido } from "./types";
import HoyEmptyState from "./components/HoyEmptyState";

const ESTADOS_ORDEN: Array<{ key: EstadoPedido; label: string; color: string }> = [
  { key: "RECIBIDO", label: "Recibidos", color: "bg-slate-100 text-[#102a39]" },
  {
    key: "EN_PREPARACION",
    label: "En preparación",
    color: "bg-[#7622ed]/10 text-[#7622ed]",
  },
  { key: "LISTO", label: "Listos", color: "bg-sky-100 text-sky-800" },
  { key: "EN_VIAJE", label: "En viaje", color: "bg-indigo-100 text-indigo-800" },
  {
    key: "ENTREGADO",
    label: "Entregados",
    color: "bg-emerald-100 text-emerald-800",
  },
  { key: "CANCELADO", label: "Cancelados", color: "bg-red-100 text-red-700" },
];

const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  RECIBIDO: "Recibido",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo",
  EN_VIAJE: "En viaje",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

function getRangoHoyArgentina() {
  const ahora = new Date();
  const fechaIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);

  const fechaLegible = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(ahora);

  return {
    desde: new Date(`${fechaIso}T00:00:00.000-03:00`).toISOString(),
    hasta: new Date(`${fechaIso}T23:59:59.999-03:00`).toISOString(),
    fechaLegible: fechaLegible.charAt(0).toUpperCase() + fechaLegible.slice(1),
  };
}

export default async function HoyPage() {
  const { desde, hasta, fechaLegible } = getRangoHoyArgentina();

  const [resumenRes, productosRes] = await Promise.all([
    getDashboardResumen({ desde, hasta }),
    getProductos(false),
  ]);

  const resumen = resumenRes.data;
  const productos = productosRes.data ?? [];

  // Alertas de stock bajo o sin stock en productos activos
  const alertasStock: Array<{
    key: string;
    productoId: string;
    nombre: string;
    stock: number;
  }> = [];

  for (const prod of productos) {
    if (!prod.activo) continue;
    if (prod.tiene_variantes) {
      for (const v of prod.variantes ?? []) {
        if (!v.activo) continue;
        if (v.stock_disponible <= (v.stock_minimo ?? 0)) {
          alertasStock.push({
            key: `${prod.id}-${v.id}`,
            productoId: prod.id,
            nombre: `${prod.nombre} (${v.nombre})`,
            stock: v.stock_disponible,
          });
        }
      }
    } else {
      const stock = prod.stock_disponible ?? 0;
      if (stock <= (prod.stock_minimo ?? 0)) {
        alertasStock.push({
          key: prod.id,
          productoId: prod.id,
          nombre: prod.nombre,
          stock,
        });
      }
    }
  }

  return (
    <section className="space-y-4 pt-2 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#102a39]">Hoy</h1>
          <p className="text-xs text-[#586574]">{fechaLegible}</p>
        </div>

        <Link
          href="/pedidos/nuevo"
          className="rounded-full bg-[#056184] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#044d69]"
        >
          + Nuevo pedido
        </Link>
      </div>

      {resumenRes.error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {resumenRes.error}
        </p>
      ) : (
        resumen && (
          <>
            {resumen.pedidosRequiriendoRevision > 0 && (
              <Link
                href="/pedidos"
                className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-3.5 transition hover:border-red-300"
              >
                <div>
                  <p className="text-xs font-bold text-red-700">
                    {resumen.pedidosRequiriendoRevision}{" "}
                    {resumen.pedidosRequiriendoRevision === 1
                      ? "pedido requiere revisión"
                      : "pedidos requieren revisión"}
                  </p>
                  <p className="text-[11px] text-red-600">
                    Tocá para revisarlos en el listado de pedidos.
                  </p>
                </div>
                <span className="text-lg font-bold text-red-700">›</span>
              </Link>
            )}

            {/* Indicadores principales del día */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3.5">
                <p className="text-[11px] font-semibold text-[#586574]">
                  Pedidos hoy
                </p>
                <p className="mt-1 text-xl font-extrabold text-[#102a39]">
                  {resumen.cantidadPedidos}
                </p>
              </div>

              <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3.5">
                <p className="text-[11px] font-semibold text-[#586574]">
                  Cobrado hoy
                </p>
                <p className="mt-1 text-base font-extrabold text-emerald-700">
                  ${Number(resumen.facturado).toLocaleString("es-AR")}
                </p>
              </div>

              <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3.5">
                <p className="text-[11px] font-semibold text-[#586574]">
                  Por cobrar
                </p>
                <p className="mt-1 text-base font-extrabold text-amber-700">
                  ${Number(resumen.pendienteCobro).toLocaleString("es-AR")}
                </p>
              </div>
            </div>

            {/* Estados de pedidos del día */}
            <div className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#102a39]">
                  Movimiento de hoy por estado
                </h2>
                <Link
                  href="/pedidos"
                  className="text-xs font-bold text-[#7622ed]"
                >
                  Ver todos ›
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {ESTADOS_ORDEN.map((item) => {
                  const count = resumen.porEstado?.[item.key] ?? 0;
                  return (
                    <Link
                      key={item.key}
                      href="/pedidos"
                      className="flex items-center justify-between rounded-xl border border-[#e2e8f0] px-3 py-2.5 transition hover:border-[#7622ed]"
                    >
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${item.color}`}
                      >
                        {item.label}
                      </span>
                      <span className="text-sm font-extrabold text-[#102a39]">
                        {count}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Alertas de stock */}
            {alertasStock.length > 0 && (
              <div className="space-y-2.5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#102a39]">
                    Alertas de stock ({alertasStock.length})
                  </h2>
                  <Link
                    href="/catalogo"
                    className="text-xs font-bold text-[#7622ed]"
                  >
                    Ir al catálogo ›
                  </Link>
                </div>

                <div className="divide-y divide-amber-200/70">
                  {alertasStock.slice(0, 5).map((alerta) => (
                    <Link
                      key={alerta.key}
                      href={`/catalogo/${alerta.productoId}`}
                      className="flex items-center justify-between py-2 text-xs"
                    >
                      <span className="font-semibold text-[#102a39]">
                        {alerta.nombre}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-bold ${
                          alerta.stock === 0
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {alerta.stock === 0
                          ? "Sin stock"
                          : `${alerta.stock} u.`}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Últimos pedidos */}
            <div className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#102a39]">
                  Últimos pedidos
                </h2>
                <Link
                  href="/pedidos"
                  className="text-xs font-bold text-[#7622ed]"
                >
                  Gestionar ›
                </Link>
              </div>

              {resumen.ultimosPedidos.length === 0 ? (
                <HoyEmptyState />
              ) : (
                <div className="divide-y divide-[#e2e8f0]">
                  {resumen.ultimosPedidos.map((pedido) => {
                    const num = pedido.numero ?? pedido.numero_pedido;
                    return (
                      <Link
                        key={pedido.id}
                        href={`/pedidos/${pedido.id}`}
                        className="flex items-center justify-between py-2.5 text-sm transition hover:opacity-80"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-[#102a39]">
                            {num ? `Pedido #${num}` : "Pedido"}
                            {pedido.cliente?.nombre
                              ? ` · ${pedido.cliente.nombre}`
                              : ""}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full bg-[#7622ed]/10 px-2 py-0.5 text-[11px] font-bold text-[#7622ed]">
                              {ETIQUETA_ESTADO[pedido.estado] ?? pedido.estado}
                            </span>
                            {pedido.estado_cobro && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  pedido.estado_cobro === "PAGADO"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {pedido.estado_cobro === "PAGADO"
                                  ? "Cobrado"
                                  : "Pendiente"}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-[#102a39]">
                            ${Number(pedido.total).toLocaleString("es-AR")}
                          </span>
                          <span className="text-base font-bold text-[#586574]">
                            ›
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )
      )}
    </section>
  );
}