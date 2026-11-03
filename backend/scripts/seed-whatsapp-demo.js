// Script de desarrollo: registra una conexión WhatsApp "demo" (Meta Cloud API número de prueba)
// sin usar Embedded Signup. Ejecutar desde backend/.
//
// Variables de entorno requeridas (NO pasar el token por CLI):
//   SUPABASE_URL (o VITE_SUPABASE_URL)
//   SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY)
//   WHATSAPP_ENCRYPTION_KEY
//   WHATSAPP_ACCESS_TOKEN   (token temporal de Meta; nunca se imprime)
//
// Argumentos:
//   --emprendimientoId <uuid>
//   --wabaId <string>
//   --phoneNumberId <string>
//   --numeroTelefono <string>
//   --nombreCanal <string>      (opcional)
//   --graphVersion <string>     (opcional, default v21.0)

import { createClient } from "@supabase/supabase-js";
import { cifrar } from "../src/utils/encryption.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const ENCRYPTION_KEY = process.env.WHATSAPP_ENCRYPTION_KEY;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const emprendimientoId = get("--emprendimientoId");
const wabaId = get("--wabaId");
const phoneNumberId = get("--phoneNumberId");
const numeroTelefono = get("--numeroTelefono");
const nombreCanal = get("--nombreCanal") || "Canal WhatsApp demo";
const graphVersion = "v21.0";

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!SUPABASE_URL) fail("Falta SUPABASE_URL (o VITE_SUPABASE_URL).");
if (!SUPABASE_SECRET_KEY)
  fail("Falta SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY).");
if (!ENCRYPTION_KEY) fail("Falta WHATSAPP_ENCRYPTION_KEY.");
if (!ACCESS_TOKEN)
  fail("Falta WHATSAPP_ACCESS_TOKEN (variable de entorno temporal).");
if (!emprendimientoId || !wabaId || !phoneNumberId || !numeroTelefono) {
  fail(
    "Uso: node scripts/seed-whatsapp-demo.js --emprendimientoId <uuid> --wabaId <id> --phoneNumberId <id> --numeroTelefono <tel> [--nombreCanal <nombre>] [--graphVersion v21.0]",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function verificarMeta() {
  const phoneRes = await fetch(
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}?fields=display_phone_number,verified_name&access_token=${encodeURIComponent(ACCESS_TOKEN)}`,
  );
  const phoneJson = await phoneRes.json();
  if (!phoneRes.ok || phoneJson.error)
    fail(
      `Meta Graph API: phone_number_id invalido o token sin acceso: ${JSON.stringify(phoneJson.error || phoneJson)}`,
    );

  const wabaRes = await fetch(
    `https://graph.facebook.com/${graphVersion}/${wabaId}/phone_numbers?access_token=${encodeURIComponent(ACCESS_TOKEN)}`,
  );
  const wabaJson = await wabaRes.json();
  if (!wabaRes.ok || wabaJson.error)
    fail(
      `Meta Graph API: WABA invalido o token sin acceso: ${JSON.stringify(wabaJson.error || wabaJson)}`,
    );
  const numeros = Array.isArray(wabaJson.data) ? wabaJson.data : [];
  if (!numeros.find((n) => n.id === phoneNumberId))
    fail(
      `El phone_number_id ${phoneNumberId} no pertenece al WABA ${wabaId} segun Meta.`,
    );
  console.log("Verificacion Meta OK.");
}

async function main() {
  await verificarMeta();

  const { data: emp, error: errEmp } = await supabase
    .from("emprendimientos")
    .select("id")
    .eq("id", emprendimientoId)
    .maybeSingle();
  if (errEmp) fail(`Error consultando emprendimiento: ${errEmp.message}`);
  if (!emp) fail(`No existe el emprendimiento ${emprendimientoId}.`);

  const { data: connExistente, error: errConnEx } = await supabase
    .from("whatsapp_conexiones")
    .select("id")
    .eq("emprendimiento_id", emprendimientoId)
    .eq("waba_id", wabaId)
    .maybeSingle();
  if (errConnEx)
    fail(`Error consultando conexion existente: ${errConnEx.message}`);

  let conexionId;
  if (connExistente) {
    conexionId = connExistente.id;
    console.log(`Conexion existente reutilizada: ${conexionId}`);
  } else {
    const { data: conexion, error: errConn } = await supabase
      .from("whatsapp_conexiones")
      .insert({
        emprendimiento_id: emprendimientoId,
        waba_id: wabaId,
        app_id: null,
        config_id: null,
        access_token_encrypted: cifrar(ACCESS_TOKEN),
        token_expires_at: null,
        estado: "activo",
        metadata: { origen: "demo_seed" },
      })
      .select("id")
      .single();
    if (errConn) fail(`Error creando conexion: ${errConn.message}`);
    conexionId = conexion.id;
    console.log(`Conexion creada: ${conexionId}`);
  }

  const { data: numExistente, error: errNumEx } = await supabase
    .from("whatsapp_numeros")
    .select("id")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  if (errNumEx) {
    if (!connExistente)
      await supabase.from("whatsapp_conexiones").delete().eq("id", conexionId);
    fail(`Error consultando numero existente: ${errNumEx.message}`);
  }

  let numeroId;
  if (numExistente) {
    numeroId = numExistente.id;
    console.log(`Numero existente reutilizado: ${numeroId}`);
  } else {
    const { data: numero, error: errNum } = await supabase
      .from("whatsapp_numeros")
      .insert({
        whatsapp_conexion_id: conexionId,
        phone_number_id: phoneNumberId,
        numero_telefono: numeroTelefono,
        nombre_registro: "Demo",
        nombre_canal: nombreCanal,
        activo: true,
      })
      .select("id")
      .single();
    if (errNum) {
      if (!connExistente)
        await supabase
          .from("whatsapp_conexiones")
          .delete()
          .eq("id", conexionId);
      fail(`Error creando numero: ${errNum.message}`);
    }
    numeroId = numero.id;
    console.log(`Numero registrado: ${numeroId}`);
  }

  const { data: canalExistente, error: errCanalEx } = await supabase
    .from("canales")
    .select("id")
    .eq("emprendimiento_id", emprendimientoId)
    .eq("identificador_externo", phoneNumberId)
    .maybeSingle();
  if (errCanalEx)
    fail(`Error consultando canal existente: ${errCanalEx.message}`);

  if (canalExistente) {
    const { error: errUpd } = await supabase
      .from("canales")
      .update({
        whatsapp_conexion_id: conexionId,
        activo: true,
        nombre: nombreCanal,
      })
      .eq("id", canalExistente.id);
    if (errUpd) fail(`Error actualizando canal: ${errUpd.message}`);
    console.log(`Canal actualizado: ${canalExistente.id}`);
  } else {
    const { data: canal, error: errCanal } = await supabase
      .from("canales")
      .insert({
        emprendimiento_id: emprendimientoId,
        tipo: "WHATSAPP",
        identificador_externo: phoneNumberId,
        nombre: nombreCanal,
        activo: true,
        whatsapp_conexion_id: conexionId,
      })
      .select("id")
      .single();
    if (errCanal) {
      if (!numExistente)
        await supabase.from("whatsapp_numeros").delete().eq("id", numeroId);
      if (!connExistente)
        await supabase
          .from("whatsapp_conexiones")
          .delete()
          .eq("id", conexionId);
      fail(`Error creando canal: ${errCanal.message}`);
    }
    console.log(`Canal creado: ${canal.id}`);
  }

  console.log("\nListo. Variables para Postman:");
  console.log(`  conexionId = ${conexionId}`);
  console.log(`  wabaId = ${wabaId}`);
  console.log(`  phoneNumberId = ${phoneNumberId}`);
  console.log(`  numeroTelefono = ${numeroTelefono}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
