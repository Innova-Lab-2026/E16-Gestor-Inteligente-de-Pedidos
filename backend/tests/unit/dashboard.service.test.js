import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { DashboardService } from "../../src/modules/dashboard/dashboard.service.js";
import { buildPeriodoPedidosFilter } from "../../src/modules/dashboard/dashboard.dao.js";
import { ORDER_STATUS } from "../../src/constants/order-status.enum.js";

describe("DashboardService", () => {
  test("filtra períodos por fecha prevista y usa created_at solo si falta", () => {
    assert.equal(
      buildPeriodoPedidosFilter({
        desde: "2026-11-24T03:00:00.000Z",
        hasta: "2026-11-25T02:59:59.999Z",
      }),
      "and(fecha_prevista_entrega.gte.2026-11-24,fecha_prevista_entrega.lte.2026-11-24),and(fecha_prevista_entrega.is.null,created_at.gte.2026-11-24T03:00:00.000Z,created_at.lte.2026-11-25T02:59:59.999Z)",
    );
    assert.equal(buildPeriodoPedidosFilter(), null);
  });

  test("pasa la fecha de despacho a los pedidos, revisiones y últimos pedidos", async () => {
    const fechas = [];
    const dashboardDao = {
      async pedidosPorEstado(_emprendimientoId, rango) {
        fechas.push(rango.fechaDespacho);
        return [];
      },
      async countPedidosRequiriendoRevision(_emprendimientoId, rango) {
        fechas.push(rango.fechaDespacho);
        return 0;
      },
      async ultimosPedidos(_emprendimientoId, _limite, rango) {
        fechas.push(rango.fechaDespacho);
        return [];
      },
      async productosParaStock() {
        return [];
      },
    };

    await new DashboardService({ dashboardDao }).resumen("tenant", {
      fechaDespacho: "2026-11-24",
    });

    assert.deepEqual(fechas, [
      "2026-11-24",
      "2026-11-24",
      "2026-11-24",
    ]);
  });

  test("agrega ventas válidas, stock bajo y estados incluyendo cancelados", async () => {
    const dashboardDao = {
      async pedidosPorEstado() {
        return [
          {
            estado: ORDER_STATUS.RECIBIDO,
            total: 50,
            estado_cobro: "PENDIENTE",
            items_pedido: [
              {
                producto_id: "producto-a",
                cantidad: 2,
                subtotal: 20,
                productos: { nombre: "Jabón" },
              },
              {
                producto_id: "producto-b",
                cantidad: 3,
                subtotal: 30,
                productos: { nombre: "Velas" },
              },
            ],
          },
          {
            estado: ORDER_STATUS.CANCELADO,
            total: 999,
            estado_cobro: "PAGADO",
            items_pedido: [
              {
                producto_id: "producto-a",
                cantidad: 9,
                subtotal: 90,
                productos: { nombre: "Jabón" },
              },
            ],
          },
          {
            estado: ORDER_STATUS.ENTREGADO,
            total: 40,
            estado_cobro: "PAGADO",
            items_pedido: [
              {
                producto_id: "producto-a",
                cantidad: 4,
                subtotal: 40,
                productos: { nombre: "Jabón" },
              },
            ],
          },
        ];
      },
      async countPedidosRequiriendoRevision() {
        return 2;
      },
      async ultimosPedidos() {
        return [];
      },
      async productosParaStock() {
        return [
          {
            activo: true,
            tiene_variantes: false,
            id: "simple-bajo",
            nombre: "Jabón",
            stock_disponible: 2,
            stock_minimo: 2,
          },
          {
            activo: true,
            tiene_variantes: false,
            id: "simple-ok",
            nombre: "Velas",
            stock_disponible: 5,
            stock_minimo: 2,
          },
          {
            activo: false,
            tiene_variantes: false,
            id: "simple-inactivo",
            nombre: "Crema",
            stock_disponible: 0,
            stock_minimo: 1,
          },
          {
            activo: true,
            tiene_variantes: true,
            id: "producto-variantes",
            nombre: "Remera",
            stock_minimo: 2,
            variantes: [
              {
                id: "variante-s",
                nombre: "Talle S",
                activo: true,
                stock_disponible: 1,
                stock_minimo: null,
              },
              {
                id: "variante-m",
                nombre: "Talle M",
                activo: true,
                stock_disponible: 10,
                stock_minimo: null,
              },
              {
                id: "variante-xs",
                nombre: "Talle XS",
                activo: true,
                stock_disponible: 0,
                stock_minimo: 0,
              },
              {
                id: "variante-inactiva",
                nombre: "Talle XL",
                activo: false,
                stock_disponible: 0,
                stock_minimo: 1,
              },
            ],
          },
        ];
      },
    };

    const result = await new DashboardService({ dashboardDao }).resumen("tenant");

    assert.equal(result.porEstado[ORDER_STATUS.CANCELADO], 1);
    assert.equal(result.cantidadPedidos, 2);
    assert.equal(result.facturado, 40);
    assert.equal(result.pendienteCobro, 50);
    assert.equal(result.unidadesVendidas, 9);
    assert.deepEqual(result.productosMasVendidos, [
      {
        productoId: "producto-a",
        nombre: "Jabón",
        unidadesVendidas: 6,
        totalVendido: 60,
      },
      {
        productoId: "producto-b",
        nombre: "Velas",
        unidadesVendidas: 3,
        totalVendido: 30,
      },
    ]);
    assert.equal(result.productosBajoStock, 3);
    assert.deepEqual(result.productosBajoStockDetalle, [
      {
        productoId: "simple-bajo",
        varianteId: null,
        nombre: "Jabón",
        stockDisponible: 2,
      },
      {
        productoId: "producto-variantes",
        varianteId: "variante-s",
        nombre: "Remera — Talle S",
        stockDisponible: 1,
      },
      {
        productoId: "producto-variantes",
        varianteId: "variante-xs",
        nombre: "Remera — Talle XS",
        stockDisponible: 0,
      },
    ]);
  });
});
