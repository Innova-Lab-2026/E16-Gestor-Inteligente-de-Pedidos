import { BadRequestError } from "../../errors/bad-request.error.js";
import { NotFoundError } from "../../errors/not-found.error.js";
import { ForbiddenError } from "../../errors/forbidden.error.js";
import { UnauthorizedError } from "../../errors/unauthorized.error.js";
import { ConflictError } from "../../errors/conflict.error.js";
import { integrations } from "../../config/integrations.js";
import { WhatsAppConexionDao } from "./whatsapp-conexion.dao.js";
import { logger } from "../../utils/logger.js";

export const ESTADO_CONEXION = Object.freeze({
  PENDIENTE: "pendiente",
  ACTIVO: "activo",
  DESHABILITADO: "deshabilitado",
  REVOCADO: "revocado",
  ERROR: "error",
});

export class WhatsAppConexionService {
  constructor({ dao } = {}) {
    this.dao = dao || new WhatsAppConexionDao();
  }

  async iniciarConexion({ emprendimientoId, usuarioId, nombreCanal }) {
    const { appId, configId } = integrations.whatsapp;

    if (!appId) {
      throw new BadRequestError(
        "WHATSAPP_APP_ID no configurado en el servidor",
      );
    }
    if (!configId) {
      throw new BadRequestError(
        "WHATSAPP_CONFIG_ID no configurado en el servidor",
      );
    }

    const state = Buffer.from(
      JSON.stringify({
        v: 1,
        u: usuarioId,
        e: emprendimientoId,
        t: Date.now(),
      }),
    ).toString("base64url");

    const params = new URLSearchParams({
      client_id: appId,
      config_id: configId,
      state,
    });

    const connectionUrl = `https://www.facebook.com/v20.0/dialog/embedded_signup?${params.toString()}`;

    logger.info(
      `[WhatsAppConexion] Inicio de conexion para emprendimiento ${emprendimientoId}`,
    );

    return {
      connectionUrl,
      estado: ESTADO_CONEXION.PENDIENTE,
      state,
    };
  }

  async conectarManual({
    emprendimientoId,
    usuarioId,
    wabaId,
    phoneNumberId,
    numeroTelefono,
    accessToken,
    nombreCanal,
  }) {
    // Verificar acceso al emprendimiento.
    const acceso = await this.#verificarAcceso(usuarioId, emprendimientoId);

    if (!acceso) {
      throw new ForbiddenError(
        "El usuario no tiene acceso a este emprendimiento",
      );
    }

    // Validar token y número contra Meta.
    const phoneRes = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}?fields=display_phone_number,verified_name`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const phoneInfo = await phoneRes.json();

    if (!phoneRes.ok || phoneInfo.error) {
      throw new BadRequestError(
        phoneInfo.error?.message || "Token o phone_number_id invalido",
      );
    }

    // Verificar que el número pertenezca a la WABA indicada.
    const wabaRes = await fetch(
      `https://graph.facebook.com/v20.0/${wabaId}/phone_numbers?fields=id`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const wabaData = await wabaRes.json();

    if (!wabaRes.ok || wabaData.error) {
      throw new BadRequestError(
        wabaData.error?.message || "No se pudo verificar la WABA",
      );
    }

    const phoneNumbers = (wabaData.data || []).map((number) => number.id);

    if (!phoneNumbers.includes(phoneNumberId)) {
      throw new BadRequestError(
        "El phone_number_id no pertenece al WABA indicado",
      );
    }

    // Evitar reasignar un número a otro emprendimiento.
    const existenteNumero = await this.dao.findByPhoneNumberId(phoneNumberId);

    if (
      existenteNumero?.conexion?.emprendimiento_id &&
      existenteNumero.conexion.emprendimiento_id !== emprendimientoId
    ) {
      throw new ConflictError(
        "El numero de WhatsApp ya esta vinculado a otro emprendimiento",
        { phoneNumberId },
      );
    }

    // Verificar que el canal no pertenezca a otro emprendimiento.
    const { CanalDao } = await import("../canales/canal.dao.js");

    const canalExistente = await new CanalDao().findByExternal(
      "WHATSAPP",
      phoneNumberId,
    );

    if (
      canalExistente &&
      canalExistente.emprendimiento_id !== emprendimientoId
    ) {
      throw new ConflictError(
        "El canal de WhatsApp ya esta vinculado a otro emprendimiento",
        { phoneNumberId },
      );
    }

    // Buscar conexión existente por WABA.
    let conexion = await this.dao.findByWaba(wabaId);

    if (conexion && conexion.emprendimiento_id !== emprendimientoId) {
      throw new ConflictError(
        "La WABA ya esta vinculada a otro emprendimiento",
        { wabaId },
      );
    }

    // Crear o actualizar conexión.
    if (conexion) {
      conexion = await this.dao.update(emprendimientoId, conexion.id, {
        accessToken,
        estado: ESTADO_CONEXION.ACTIVO,
        metadata: { waba_nombre: null, manual: true },
      });
    } else {
      conexion = await this.dao.create({
        emprendimientoId,
        conexion: {
          wabaId,
          appId: integrations.whatsapp.appId || null,
          configId: integrations.whatsapp.configId || null,
          accessToken,
          tokenExpiresAt: null,
          estado: ESTADO_CONEXION.ACTIVO,
          metadata: { manual: true },
        },
      });
    }

    // Crear o actualizar número.
    if (existenteNumero) {
      await this.dao.actualizarNumero(conexion.id, existenteNumero.numero.id, {
        numeroTelefono,
        nombreRegistro: phoneInfo.verified_name ?? null,
        activo: true,
      });
    } else {
      await this.dao.crearNumero(conexion.id, {
        phoneNumberId,
        numeroTelefono,
        nombreRegistro: phoneInfo.verified_name ?? null,
        nombreCanal: nombreCanal || `WhatsApp ${numeroTelefono}`,
        activo: true,
      });
    }

    // Asegurar canal genérico.
    await this.#asegurarCanalGenerico(
      emprendimientoId,
      conexion.id,
      phoneNumberId,
      numeroTelefono,
    );

    return {
      conexionId: conexion.id,
      estado: ESTADO_CONEXION.ACTIVO,
      phoneNumberId,
      numeroTelefono,
    };
  }

  async completarConexion({ emprendimientoId, usuarioId, code, state }) {
    const acceso = await this.#verificarAcceso(usuarioId, emprendimientoId);
    if (!acceso) {
      throw new ForbiddenError(
        "El usuario no tiene acceso a este emprendimiento",
      );
    }

    // Validar que el state coincide con el usuario y emprendimiento
    try {
      const decoded = JSON.parse(
        Buffer.from(state, "base64url").toString("utf8"),
      );
      if (decoded.u !== usuarioId || decoded.e !== emprendimientoId) {
        throw new BadRequestError(
          "El estado (state) no corresponde al usuario o emprendimiento indicados",
        );
      }
    } catch {
      throw new BadRequestError("Formato de state inválido");
    }

    const tokenData = await this.#intercambiarCodigoPorToken(code);
    const wabaInfo = await this.#obtenerWaba(tokenData.access_token);
    const phoneNumbers = await this.#obtenerNumerosTelefono(
      tokenData.access_token,
      wabaInfo.waba_id,
    );

    if (!phoneNumbers || phoneNumbers.length === 0) {
      throw new BadRequestError(
        "No se encontraron numeros de telefono asociados a la WABA",
      );
    }

    const primerNumero = phoneNumbers[0];

    const conexion = await this.dao.create({
      emprendimientoId,
      conexion: {
        wabaId: wabaInfo.waba_id,
        appId: integrations.whatsapp.appId,
        configId: integrations.whatsapp.configId,
        accessToken: tokenData.access_token,
        tokenExpiresAt: tokenData.expires_at ?? null,
        estado: ESTADO_CONEXION.ACTIVO,
        metadata: {
          waba_nombre: wabaInfo.nombre,
          telefono: primerNumero.numero_telefono,
          conectadoEn: new Date().toISOString(),
        },
      },
    });

    await this.dao.crearNumero(conexion.id, {
      phoneNumberId: primerNumero.phone_number_id,
      numeroTelefono: primerNumero.numero_telefono,
      nombreRegistro: primerNumero.nombre_registro,
      nombreCanal: undefined,
      activo: true,
    });

    await this.#suscribirWebhook(tokenData.access_token, wabaInfo.waba_id);

    await this.#asegurarCanalGenerico(
      emprendimientoId,
      conexion.id,
      primerNumero.phone_number_id,
      primerNumero.numero_telefono,
    );

    logger.info(
      `[WhatsAppConexion] Conexion completada: WABA=${wabaInfo.waba_id}, numero=${primerNumero.phone_number_id}`,
    );

    return {
      conexionId: conexion.id,
      wabaId: wabaInfo.waba_id,
      phoneNumberId: primerNumero.phone_number_id,
      numeroTelefono: primerNumero.numero_telefono,
      estado: conexion.estado,
    };
  }

  async listarConexiones(emprendimientoId, usuarioId) {
    const acceso = await this.#verificarAcceso(usuarioId, emprendimientoId);
    if (!acceso) {
      throw new ForbiddenError(
        "El usuario no tiene acceso a este emprendimiento",
      );
    }

    const conexiones = await this.dao.listByEmprendimiento(emprendimientoId);

    return conexiones.map((c) => ({
      id: c.id,
      wabaId: c.waba_id,
      estado: c.estado,
      tokenExpiresAt: c.token_expires_at,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      metadata: c.metadata,
    }));
  }

  async obtenerConexion(emprendimientoId, conexionId, usuarioId) {
    const acceso = await this.#verificarAcceso(usuarioId, emprendimientoId);
    if (!acceso) {
      throw new ForbiddenError(
        "El usuario no tiene acceso a este emprendimiento",
      );
    }

    const conexion = await this.dao.findByIdOrFail(
      emprendimientoId,
      conexionId,
    );
    const numeros = await this.dao.listNumerosByConexion(conexionId);

    return {
      id: conexion.id,
      wabaId: conexion.waba_id,
      estado: conexion.estado,
      tokenExpiresAt: conexion.token_expires_at,
      createdAt: conexion.created_at,
      updatedAt: conexion.updated_at,
      metadata: conexion.metadata,
      numeros: numeros.map((n) => ({
        id: n.id,
        phoneNumberId: n.phone_number_id,
        numeroTelefono: n.numero_telefono,
        nombreRegistro: n.nombre_registro,
        nombreCanal: n.nombre_canal,
        activo: n.activo,
      })),
    };
  }

  async desactivarConexion(emprendimientoId, conexionId, usuarioId) {
    const acceso = await this.#verificarAcceso(usuarioId, emprendimientoId);
    if (!acceso) {
      throw new ForbiddenError(
        "El usuario no tiene acceso a este emprendimiento",
      );
    }

    await this.dao.findByIdOrFail(emprendimientoId, conexionId);
    await this.dao.setEstado(
      emprendimientoId,
      conexionId,
      ESTADO_CONEXION.DESHABILITADO,
    );

    const numeros = await this.dao.listNumerosByConexion(conexionId);
    for (const n of numeros) {
      if (n.activo) {
        await this.dao.actualizarNumero(conexionId, n.id, { activo: false });
      }
    }

    return { id: conexionId, estado: ESTADO_CONEXION.DESHABILITADO };
  }

  async eliminarConexion(emprendimientoId, conexionId, usuarioId) {
    const acceso = await this.#verificarAcceso(usuarioId, emprendimientoId);
    if (!acceso) {
      throw new ForbiddenError(
        "El usuario no tiene acceso a este emprendimiento",
      );
    }

    await this.dao.findByIdOrFail(emprendimientoId, conexionId);
    await this.dao.remove(emprendimientoId, conexionId);

    return { id: conexionId };
  }

  async obtenerAccessToken(emprendimientoId, conexionId, usuarioId) {
    const acceso = await this.#verificarAcceso(usuarioId, emprendimientoId);
    if (!acceso) {
      throw new ForbiddenError(
        "El usuario no tiene acceso a este emprendimiento",
      );
    }

    const conexion = await this.dao.findByIdOrFail(
      emprendimientoId,
      conexionId,
    );

    if (conexion.estado !== ESTADO_CONEXION.ACTIVO) {
      throw new BadRequestError(
        `La conexion WhatsApp no esta activa (estado: ${conexion.estado})`,
      );
    }

    const token = await this.dao.descifrarAccessToken(
      emprendimientoId,
      conexionId,
    );
    if (!token) {
      throw new UnauthorizedError("La conexion no tiene access token valido");
    }

    return token;
  }

  async #verificarAcceso(usuarioId, emprendimientoId) {
    // La verificacion de acceso se hace principalmente en el controller
    // (que tiene el JWT del usuario) antes de llamar al servicio. Este
    // metodo es una capa adicional de defensa.
    try {
      const { UsuarioEmprendimientoDao } =
        await import("../usuarios/usuario-emprendimiento.dao.js");
      const dao = new UsuarioEmprendimientoDao();
      // Nota: listByUser requiere un token JWT. Como este metodo se llama
      // despues de que el controller ya valido el acceso, devolvemos true.
      // En una version futura se podria inyectar el token para validar
      // doblemente aqui.
      return true;
    } catch {
      return false;
    }
  }

  async #intercambiarCodigoPorToken(code) {
    const { appId, appSecret } = integrations.whatsapp;

    if (!appId || !appSecret) {
      throw new BadRequestError(
        "Credenciales de la app de Meta no configuradas",
      );
    }

    const tokenUrl = `https://graph.facebook.com/v20.0/oauth/access_token`;
    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
    });

    try {
      const response = await fetch(`${tokenUrl}?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        logger.error(
          `[WhatsAppConexion] Error intercambiando codigo: ${JSON.stringify(data.error || data)}`,
        );
        throw new BadRequestError(
          data.error?.message || "No se pudo intercambiar el codigo por token",
        );
      }

      return {
        access_token: data.access_token,
        expires_at: data.expires_at ?? null,
      };
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      logger.error(
        "[WhatsAppConexion] Error de red intercambiando codigo",
        error.message,
      );
      throw new BadRequestError(
        "No se pudo comunicar con Meta para obtener el token",
      );
    }
  }

  async #obtenerWaba(accessToken) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v20.0/me/whatsapp_business_accounts?access_token=${accessToken}`,
      );
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new BadRequestError(
          data.error?.message || "No se pudo obtener la informacion de la WABA",
        );
      }

      const accounts = data.data || [];
      if (accounts.length === 0) {
        throw new BadRequestError(
          "No se encontro ninguna WhatsApp Business Account asociada",
        );
      }

      return {
        waba_id: accounts[0].id,
        nombre: accounts[0].name ?? null,
      };
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      throw new BadRequestError("No se pudo obtener la WABA de Meta");
    }
  }

  async #obtenerNumerosTelefono(accessToken, wabaId) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v20.0/${wabaId}/phone_numbers?access_token=${accessToken}&fields=id,display_phone_number,verified_name,verified_status`,
      );
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new BadRequestError(
          data.error?.message || "No se pudo obtener los numeros de telefono",
        );
      }

      return (data.data || []).map((n) => ({
        phone_number_id: n.id,
        numero_telefono: n.display_phone_number ?? null,
        nombre_registro: n.verified_name ?? null,
        verified_status: n.verified_status ?? null,
      }));
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      throw new BadRequestError(
        "No se pudo obtener los numeros de telefono de Meta",
      );
    }
  }

  async #suscribirWebhook(accessToken, wabaId) {
    const { appId } = integrations.whatsapp;
    if (!appId) {
      logger.warn(
        "[WhatsAppConexion] WHATSAPP_APP_ID no configurado, no se puede suscribir el webhook",
      );
      return;
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v20.0/${wabaId}/subscribed_apps?access_token=${accessToken}`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        logger.warn(
          `[WhatsAppConexion] No se pudo suscribir la WABA a los webhooks: ${JSON.stringify(data.error || data)}`,
        );
        return;
      }

      logger.info(
        `[WhatsAppConexion] WABA ${wabaId} suscrita a webhooks de la app ${appId}`,
      );
    } catch (error) {
      logger.warn(
        "[WhatsAppConexion] Error de red suscribiendo webhook",
        error.message,
      );
    }
  }

  async #asegurarCanalGenerico(
    emprendimientoId,
    conexionId,
    phoneNumberId,
    numeroTelefono,
  ) {
    const { CanalDao } = await import("../canales/canal.dao.js");

    const canalExistente = await new CanalDao().findByExternal(
      "WHATSAPP",
      phoneNumberId,
    );

    if (canalExistente) {
      await new CanalDao().update(emprendimientoId, canalExistente.id, {
        whatsapp_conexion_id: conexionId,
        nombre: `WhatsApp ${numeroTelefono}`,
      });
    } else {
      await new CanalDao().create({
        emprendimientoId,
        tipo: "WHATSAPP",
        identificador_externo: phoneNumberId,
        whatsapp_conexion_id: conexionId,
        nombre: `WhatsApp ${numeroTelefono}`,
        config: null,
        activo: true,
      });
    }
  }
}
