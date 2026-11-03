import {
  createSupabaseClient,
  createSecretClient,
} from "../../config/database.js";
import { NotFoundError } from "../../errors/not-found.error.js";
import { ConflictError } from "../../errors/conflict.error.js";
import { cifrar, descifrar } from "../../utils/encryption.js";

/**
 * Acceso a `whatsapp_conexiones` y `whatsapp_numeros`.
 *
 * Las conexiones contienen credenciales cifradas. El DAO nunca devuelve
 * el access token en texto plano: solo `descifrarAccessToken()` lo revela
 * y solo se usa internamente al enviar mensajes o renovar.
 *
 * El cliente de Supabase usa el JWT del usuario (RLS) para operaciones
 * autenticadas y la clave secreta solo para la resolucion de webhooks
 * (sin sesion).
 */
export class WhatsAppConexionDao {
  constructor(token) {
    this.token = token;
  }

  #client() {
    return this.token
      ? createSupabaseClient(this.token)
      : createSecretClient();
  }

  async create({ emprendimientoId, conexion }) {
    const { accessToken, ...resto } = conexion;

    const { data, error } = await this.#client()
      .from("whatsapp_conexiones")
      .insert({
        emprendimiento_id: emprendimientoId,
        waba_id: resto.wabaId,
        app_id: resto.appId,
        config_id: resto.configId,
        access_token_encrypted: cifrar(accessToken),
        token_expires_at: resto.tokenExpiresAt ?? null,
        estado: resto.estado ?? "pendiente",
        metadata: resto.metadata ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ConflictError(
          "Ya existe una conexion de WhatsApp para este WABA o emprendimiento",
          { wabaId: resto.wabaId }
        );
      }
      throw error;
    }
    return data;
  }

  async listByEmprendimiento(emprendimientoId) {
    const { data, error } = await this.#client()
      .from("whatsapp_conexiones")
      .select("*")
      .eq("emprendimiento_id", emprendimientoId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async findById(emprendimientoId, id) {
    const { data, error } = await this.#client()
      .from("whatsapp_conexiones")
      .select("*")
      .eq("id", id)
      .eq("emprendimiento_id", emprendimientoId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async findByIdOrFail(emprendimientoId, id) {
    const conexion = await this.findById(emprendimientoId, id);
    if (!conexion) {
      throw new NotFoundError(`Conexion WhatsApp ${id} no encontrada`);
    }
    return conexion;
  }

  async findByWaba(wabaId) {
    const { data, error } = await this.#client()
      .from("whatsapp_conexiones")
      .select("*")
      .eq("waba_id", wabaId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async findByPhoneNumberId(phoneNumberId) {
    const { data, error } = await createSecretClient()
      .from("whatsapp_numeros")
      .select(
        `
        *,
        whatsapp_conexiones (
          id,
          emprendimiento_id,
          estado,
          access_token_encrypted,
          token_expires_at
        )
      `
      )
      .eq("phone_number_id", phoneNumberId)
      .eq("activo", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      conexion: data.whatsapp_conexiones,
      numero: {
        id: data.id,
        phoneNumberId: data.phone_number_id,
        numeroTelefono: data.numero_telefono,
        nombreRegistro: data.nombre_registro,
        nombreCanal: data.nombre_canal,
        activo: data.activo,
      },
    };
  }

  async update(emprendimientoId, id, cambios) {
    await this.findByIdOrFail(emprendimientoId, id);

    const campos = {};
    if (cambios.estado !== undefined) campos.estado = cambios.estado;
    if (cambios.tokenExpiresAt !== undefined)
      campos.token_expires_at = cambios.tokenExpiresAt;
    if (cambios.metadata !== undefined) campos.metadata = cambios.metadata;
    if (cambios.accessToken !== undefined)
      campos.access_token_encrypted = cifrar(cambios.accessToken);

    const { data, error } = await this.#client()
      .from("whatsapp_conexiones")
      .update({ ...campos, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("emprendimiento_id", emprendimientoId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async setEstado(emprendimientoId, id, estado) {
    return this.update(emprendimientoId, id, { estado });
  }

  async remove(emprendimientoId, id) {
    await this.findByIdOrFail(emprendimientoId, id);
    const { error } = await this.#client()
      .from("whatsapp_conexiones")
      .delete()
      .eq("id", id)
      .eq("emprendimiento_id", emprendimientoId);
    if (error) throw error;
    return { id };
  }

  async descifrarAccessToken(emprendimientoId, id) {
    const conexion = await this.findByIdOrFail(emprendimientoId, id);
    if (!conexion.access_token_encrypted) return null;
    return descifrar(conexion.access_token_encrypted);
  }

  async crearNumero(conexionId, numero) {
    const { data, error } = await this.#client()
      .from("whatsapp_numeros")
      .insert({
        whatsapp_conexion_id: conexionId,
        phone_number_id: numero.phoneNumberId,
        numero_telefono: numero.numeroTelefono,
        nombre_registro: numero.nombreRegistro ?? null,
        nombre_canal: numero.nombreCanal ?? null,
        activo: numero.activo ?? true,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new ConflictError(
          "El numero de WhatsApp ya esta registrado",
          { phoneNumberId: numero.phoneNumberId }
        );
      }
      throw error;
    }
    return data;
  }

  async listNumerosByConexion(conexionId) {
    const { data, error } = await this.#client()
      .from("whatsapp_numeros")
      .select("*")
      .eq("whatsapp_conexion_id", conexionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async actualizarNumero(conexionId, numeroId, cambios) {
    const campos = {};
    if (cambios.numeroTelefono !== undefined)
      campos.numero_telefono = cambios.numeroTelefono;
    if (cambios.nombreCanal !== undefined)
      campos.nombre_canal = cambios.nombreCanal;
    if (cambios.activo !== undefined) campos.activo = cambios.activo;
    if (cambios.nombreRegistro !== undefined)
      campos.nombre_registro = cambios.nombreRegistro;

    const { data, error } = await this.#client()
      .from("whatsapp_numeros")
      .update({ ...campos, updated_at: new Date().toISOString() })
      .eq("id", numeroId)
      .eq("whatsapp_conexion_id", conexionId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async eliminarNumero(conexionId, numeroId) {
    const { error } = await this.#client()
      .from("whatsapp_numeros")
      .delete()
      .eq("id", numeroId)
      .eq("whatsapp_conexion_id", conexionId);
    if (error) throw error;
    return { id: numeroId };
  }
}

export default WhatsAppConexionDao;
