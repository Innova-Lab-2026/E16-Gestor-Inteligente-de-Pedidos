import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { DashboardService } from "../../src/modules/dashboard/dashboard.service.js";
import { ORDER_STATUS } from "../../src/constants/order-status.enum.js";

describe("DashboardService", () => {
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
            stock_disponible: 2,
            stock_minimo: 2,
          },
          {
            activo: true,
            tiene_variantes: false,
            stock_disponible: 5,
            stock_minimo: 2,
          },
          {
            activo: false,
            tiene_variantes: false,
            stock_disponible: 0,
            stock_minimo: 1,
          },
          {
            activo: true,
            tiene_variantes: true,
            variantes: [
              { activo: true, stock_disponible: 1, stock_minimo: 2 },
              { activo: true, stock_disponible: 0, stock_minimo: 0 },
              { activo: false, stock_disponible: 0, stock_minimo: 1 },
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
  });
});
