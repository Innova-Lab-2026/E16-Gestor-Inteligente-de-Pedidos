import Link from "next/link";
import { backendFetch } from "@/lib/api";

type EstadoPedido =
  | "RECIBIDO"
  | "EN_PREPARACION"
  | "LISTO"
  | "EN_VIAJE"
  | "ENTREGADO"
  | "CANCELADO";

type DashboardResumen = {
  cantidadPedidos: number;
  porEstado: Partial<Record<EstadoPedido, number>>;
  facturado: number;
  pendienteCobro: number;
  pedidosRequiriendoRevision: number;
  productosBajoStock: number;
  productosBajoStockDetalle: Array<{
    productoId: string;
    varianteId: string | null;
    nombre: string;
    stockDisponible: number;
  }>;
  productosMasVendidos: Array<{
    productoId: string;
    nombre: string;
    unidadesVendidas: number;
    totalVendido: number;
  }>;
  unidadesVendidas: number;
  ultimosPedidos: Array<{
    id: string;
    numero?: number | null;
    numero_pedido?: number | null;
    estado: EstadoPedido;
    estado_cobro?: string;
    total: number | string;
    cliente?: { nombre: string } | null;
  }>;
};

type PeriodoKey = "hoy" | "7d" | "mes" | "todo";

const PERIODOS: Array<{ key: PeriodoKey; label: string }> = [
  { key: "hoy", label: "Hoy" },
  { key: "7d", label: "7 días" },
  { key: "mes", label: "Este mes" },
  { key: "todo", label: "Todo" },
];

const ESTADOS_INFO: Array<{
  key: EstadoPedido;
  label: string;
  barColor: string;
}> = [
  { key: "ENTREGADO", label: "Entregados", barColor: "bg-emerald-500" },
  { key: "EN_VIAJE", label: "En viaje", barColor: "bg-indigo-500" },
  { key: "LISTO", label: "Listos", barColor: "bg-sky-500" },
  { key: "EN_PREPARACION", label: "En preparación", barColor: "bg-[#7622ed]" },
  { key: "RECIBIDO", label: "Recibidos", barColor: "bg-slate-400" },
  { key: "CANCELADO", label: "Cancelados", barColor: "bg-red-400" },
];

function getRangoFechas(periodo: PeriodoKey): {
  desde?: string;
  hasta?: string;
  subtitulo: string;
} {
  if (periodo === "todo") {
    return { subtitulo: "Historial completo del emprendimiento" };
  }

  const ahora = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const hoyStr = fmt.format(ahora);
  const hasta = new Date(`${hoyStr}T23:59:59.999-03:00`).toISOString();

  if (periodo === "hoy") {
    return {
      desde: new Date(`${hoyStr}T00:00:00.000-03:00`).toISOString(),
      hasta,
      subtitulo: "Movimientos registrados hoy",
    };
  }

  if (periodo === "7d") {
    const hace7 = new Date(ahora.getTime() - 6 * 24 * 60 * 60 * 1000);
    const desdeStr = fmt.format(hace7);
    return {
      desde: new Date(`${desdeStr}T00:00:00.000-03:00`).toISOString(),
      hasta,
      subtitulo: "Últimos 7 días",
    };
  }

  // "mes": primer día del mes actual en Argentina
  const [anio, mes] = hoyStr.split("-");
  return {
    desde: new Date(`${anio}-${mes}-01T00:00:00.000-03:00`).toISOString(),
    hasta,
    subtitulo: "Acumulado del mes en curso",
  };
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo: rawPeriodo } = await searchParams;
  const periodo: PeriodoKey =
    rawPeriodo === "hoy" ||
    rawPeriodo === "7d" ||
    rawPeriodo === "mes" ||
    rawPeriodo === "todo"
      ? rawPeriodo
      : "mes";

  const { desde, hasta, subtitulo } = getRangoFechas(periodo);

  const query = new URLSearchParams();
  if (desde) query.set("desde", desde);
  if (hasta) query.set("hasta", hasta);
  const qs = query.toString();

  const { data: resumen, error } = await backendFetch<DashboardResumen>(
    `/dashboard${qs ? `?${qs}` : ""}`,
  );

  const facturado = Number(resumen?.facturado ?? 0);
  const pendiente = Number(resumen?.pendienteCobro ?? 0);
  const totalOperado = facturado + pendiente;
  const totalPedidos = resumen?.cantidadPedidos ?? 0;
  const cancelados = resumen?.porEstado?.CANCELADO ?? 0;
  const pedidosValidos = totalPedidos;
  const totalPedidosEnEstados = Object.values(resumen?.porEstado ?? {}).reduce(
    (total, cantidad) => total + (cantidad ?? 0),
    0,
  );
  const productosMasVendidos = resumen?.productosMasVendidos ?? [];
  const unidadesVendidas = resumen?.unidadesVendidas ?? 0;
  const ticketPromedio =
    pedidosValidos > 0 ? Math.round(totalOperado / pedidosValidos) : 0;
  const porcentajeCobrado =
    totalOperado > 0 ? Math.round((facturado / totalOperado) * 100) : 0;

  return (
    <section className="space-y-4 pt-2 pb-24">
      <div className="app-page-heading">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Reportes
        </h1>
        <p className="text-sm text-slate-500 mt-1">{subtitulo}</p>
      </div>

      {/* Selector de período */}
      <div className="grid grid-cols-4 border-b border-[#e2e8f0] text-xs">
        {PERIODOS.map((p) => {
          const activo = periodo === p.key;
          return (
            <Link
              key={p.key}
              href={`/reportes?periodo=${p.key}`}
              className={`border-b-2 py-2.5 text-center transition ${
                activo
                  ? "border-[#7622ed] font-bold text-[#7622ed]"
                  : "border-transparent font-medium text-[#586574] hover:text-[#102a39]"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      ) : (
        resumen && (
          <>
            {/* Tarjeta principal de ingresos */}
            <div className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold uppercase text-[#586574]">
                  Total operado
                </span>
                <span className="text-2xl font-extrabold text-[#102a39]">
                  ${totalOperado.toLocaleString("es-AR")}
                </span>
              </div>

              {/* Barra cobrado vs pendiente */}
              <div className="space-y-1.5">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-amber-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${porcentajeCobrado}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-emerald-700">
                    Cobrado: ${facturado.toLocaleString("es-AR")} (
                    {porcentajeCobrado}%)
                  </span>
                  <span className="text-amber-700">
                    Pendiente: ${pendiente.toLocaleString("es-AR")}
                  </span>
                </div>
              </div>
            </div>

            {/* KPIs secundarios */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3.5">
                <p className="text-[11px] font-semibold text-[#586574]">
                  Pedidos
                </p>
                <p className="mt-1 text-xl font-extrabold text-[#102a39]">
                  {totalPedidos}
                </p>
              </div>

              <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3.5">
                <p className="text-[11px] font-semibold text-[#586574]">
                  Ticket prom.
                </p>
                <p className="mt-1 text-base font-extrabold text-[#056184]">
                  ${ticketPromedio.toLocaleString("es-AR")}
                </p>
              </div>

              <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3.5">
                <p className="text-[11px] font-semibold text-[#586574]">
                  Cancelados
                </p>
                <p className="mt-1 text-xl font-extrabold text-red-600">
                  {cancelados}
                </p>
              </div>

            </div>

            <Link
              href="/catalogo?filtro=stock_bajo"
              className={`flex items-center justify-between gap-4 rounded-2xl border p-4 transition ${
                resumen.productosBajoStock > 0
                  ? "border-orange-200 bg-orange-50 hover:border-orange-300"
                  : "border-[#e2e8f0] bg-white hover:border-[#cbd5e1]"
              }`}
            >
              <div>
                <p
                  className={`text-sm font-bold ${
                    resumen.productosBajoStock > 0
                      ? "text-orange-800"
                      : "text-[#586574]"
                  }`}
                >
                  Productos y variantes con stock bajo
                </p>
                {resumen.productosBajoStock === 0 && (
                  <p className="mt-1 text-[11px] font-semibold text-[#586574]">
                    Todo en orden
                  </p>
                )}
                {resumen.productosBajoStockDetalle.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {resumen.productosBajoStockDetalle.map((item) => (
                      <li
                        key={`${item.productoId}-${item.varianteId ?? "producto"}`}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="min-w-0 truncate text-[#586574]">
                          {item.nombre}
                        </span>
                        <span className="shrink-0 font-semibold text-orange-800">
                          {item.stockDisponible} u.
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`text-xl font-extrabold ${
                    resumen.productosBajoStock > 0
                      ? "text-orange-700"
                      : "text-[#102a39]"
                  }`}
                >
                  {resumen.productosBajoStock}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    resumen.productosBajoStock > 0
                      ? "text-orange-800"
                      : "text-[#586574]"
                  }`}
                >
                  Ver en catálogo →
                </span>
              </div>
            </Link>

            {/* Distribución por estado */}
            <div className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white p-4">
              <h2 className="text-sm font-bold text-[#102a39]">
                Pedidos por estado
              </h2>

              {totalPedidosEnEstados === 0 ? (
                <p className="py-3 text-center text-xs text-[#586574]">
                  No hay pedidos en este período.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {ESTADOS_INFO.map((est) => {
                    const count = resumen.porEstado?.[est.key] ?? 0;
                    const pct =
                      totalPedidosEnEstados > 0
                        ? Math.round((count / totalPedidosEnEstados) * 100)
                        : 0;
                    return (
                      <div key={est.key} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-[#102a39]">
                            {est.label}
                          </span>
                          <span className="font-bold text-[#586574]">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${est.barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
              <p className="text-xs font-bold uppercase text-[#586574]">
                Unidades vendidas
              </p>
              <p className="mt-1 text-2xl font-extrabold text-[#102a39]">
                {unidadesVendidas.toLocaleString("es-AR")}
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white p-4">
              <h2 className="text-sm font-bold text-[#102a39]">
                Productos más vendidos
              </h2>
              {productosMasVendidos.length === 0 ? (
                <p className="py-3 text-center text-xs text-[#586574]">
                  No hay productos vendidos en este período.
                </p>
              ) : (
                <ol className="divide-y divide-[#e2e8f0]">
                  {productosMasVendidos.map((producto, index) => (
                    <li
                      key={producto.productoId}
                      className="flex items-center gap-3 py-3"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#7622ed]/10 text-xs font-bold text-[#7622ed]">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#102a39]">
                          {producto.nombre}
                        </p>
                        <p className="text-xs text-[#586574]">
                          {producto.unidadesVendidas.toLocaleString("es-AR")}{" "}
                          {producto.unidadesVendidas === 1 ? "unidad" : "unidades"}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-[#056184]">
                        $
                        {Number(producto.totalVendido).toLocaleString("es-AR")}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )
      )}
    </section>
  );
}