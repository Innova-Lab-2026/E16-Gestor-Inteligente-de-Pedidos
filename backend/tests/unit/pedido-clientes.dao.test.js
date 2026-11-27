import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { DashboardDao } from "../../src/modules/dashboard/dashboard.dao.js";
import { PedidoDao } from "../../src/modules/pedidos/pedido.dao.js";

const clienteActualizado = {
  id: "22222222-2222-2222-2222-222222222222",
  nombre: "Ana",
  apellido: "Pérez",
  telefono: "5491112345678",
  direccion: "Av. Siempre Viva 123",
  email: "ana@example.com",
};

async function conRespuestaSupabase(data, callback) {
  const fetchOriginal = globalThis.fetch;
  let urlSolicitada;
  globalThis.fetch = async (input) => {
    urlSolicitada = new URL(
      typeof input === "string" ? input : input.url,
    );
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    return await callback(() => urlSolicitada);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
}

describe("Pedidos con datos actuales de cliente", () => {
  test("el listado normaliza la relación actual de clientes", async () => {
    await conRespuestaSupabase(
      [{ id: "pedido-1", clientes: clienteActualizado }],
      async (getUrl) => {
        const pedidos = await new PedidoDao("token").list("tenant", {
          limite: 1,
        });

        assert.deepEqual(pedidos[0].cliente, clienteActualizado);
        assert.equal(pedidos[0].clientes, undefined);
        assert.ok(
          getUrl()
            .searchParams.get("select")
            .includes("clientes(id,nombre,apellido,telefono,direccion,email)"),
        );
      },
    );
  });

  test("el resumen de hoy normaliza la relación actual de clientes", async () => {
    await conRespuestaSupabase(
      [{ id: "pedido-1", clientes: clienteActualizado }],
      async () => {
        const pedidos = await new DashboardDao("token").ultimosPedidos(
          "tenant",
          1,
        );

        assert.deepEqual(pedidos[0].cliente, clienteActualizado);
        assert.equal(pedidos[0].clientes, undefined);
      },
    );
  });
});
