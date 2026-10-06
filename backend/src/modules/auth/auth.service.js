import {
  createPublicClient,
  createSupabaseClient,
} from "../../config/database.js";
import { UsuarioDao } from "../usuarios/usuario.dao.js";
import { EmprendimientoService } from "../emprendimientos/emprendimiento.service.js";
import { UnauthorizedError } from "../../errors/unauthorized.error.js";
import { BadRequestError } from "../../errors/bad-request.error.js";

/**
 * Servicio de autenticación.
 *
 * Supabase Auth es la fuente de verdad de la identidad. Este servicio
 * habla con él y no escribe ninguna tabla: el perfil espejo en `usuarios`
 * lo mantiene el trigger `on_auth_user_created` (migración 001), y el
 * emprendimiento inicial lo crea la RPC `crear_emprendimiento`.
 *
 * Todo lo que toca datos viaja con el JWT del usuario, así que RLS decide
 * fila por fila. No hay ninguna operación de este módulo que necesite una
 * clave privilegiada.
 *
 * Las dependencias se inyectan como fábricas `(token) => ...` porque el
 * token recién existe después de `signUp`/`signInWithPassword`.
 */
export class AuthService {
  /**
   * @param {{
   *   publicClientFactory?: () => import('@supabase/supabase-js').SupabaseClient,
   *   userClientFactory?: (token: string) => import('@supabase/supabase-js').SupabaseClient,
   *   usuarioDaoFactory?: (token: string) => UsuarioDao,
   *   emprendimientoServiceFactory?: (token: string) => EmprendimientoService,
   * }} [deps]
   */
  constructor({
    publicClientFactory,
    userClientFactory,
    usuarioDaoFactory,
    emprendimientoServiceFactory,
  } = {}) {
    this.publicClientFactory = publicClientFactory || createPublicClient;
    this.userClientFactory = userClientFactory || createSupabaseClient;
    this.usuarioDaoFactory =
      usuarioDaoFactory || ((token) => new UsuarioDao(token));
    this.emprendimientoServiceFactory =
      emprendimientoServiceFactory ||
      ((token) => new EmprendimientoService({ token }));
  }

  /**
   * Crea el usuario en Supabase Auth y, si el alta devuelve sesión, su
   * emprendimiento inicial.
   *
   * El perfil espejo no se escribe desde acá: lo crea el trigger de la
   * 001 dentro de la misma transacción de `auth.users`. Ese era el bug
   * original (un usuario de Auth sin fila en `usuarios`, y después el
   * 23503 al crear el emprendimiento).
   */
  async register({ email, password, metadata = {}, emprendimiento }) {
    // signUp/signInWithPassword/updateUser son endpoints de Supabase
    // Auth, no acceso a datos: no pasan por RLS y se llaman con la clave
    // publicable, exactamente igual que el navegador.
    const supabase = this.publicClientFactory();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });

    if (error) throw error;
    if (!data?.user) {
      throw new BadRequestError("Supabase Auth no devolvió un usuario");
    }

    const token = data.session?.access_token ?? null;

    // Con "Confirm email" activado, `signUp` no devuelve sesión. Sin
    // sesión no hay auth.uid(), así que no se puede escribir nada sin una
    // clave privilegiada; y usar una acá sería justamente saltarse RLS
    // sin necesidad. El alta se completa cuando el usuario confirma el
    // email y llama a POST /api/emprendimientos con su propio token.
    if (!token) {
      return {
        user: data.user,
        session: null,
        perfil: null,
        emprendimiento: null,
        pendienteConfirmacion: true,
      };
    }

    // Leer el perfil con el token del usuario valida dos cosas de una:
    // que el espejo existe y que auth.uid() es quien dice ser.
    const perfil = await this.usuarioDaoFactory(token).findById(data.user.id);
    if (!perfil) {
      throw new Error(
        "El usuario se creó en Supabase Auth pero no tiene perfil en `usuarios`. " +
          "Falta ejecutar la migración 001 (trigger `on_auth_user_created`): " +
          "ver Docs/pruebas-manuales.md, paso 3."
      );
    }

    const nombreEmprendimiento =
      emprendimiento?.nombre || metadata?.emprendimiento?.nombre;

    // El dueño lo resuelve la RPC con auth.uid(): nunca se manda por
    // parámetro, así nadie puede crear un emprendimiento a nombre de otro.
    const created = nombreEmprendimiento
      ? await this.emprendimientoServiceFactory(token).create({
          nombre: nombreEmprendimiento,
        })
      : null;

    return {
      user: data.user,
      session: data.session,
      perfil,
      emprendimiento: created,
      pendienteConfirmacion: false,
    };
  }

  /** Intercambia credenciales por un JWT. */
  async login({ email, password }) {
    const supabase = this.publicClientFactory();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.session) {
      throw new UnauthorizedError(error?.message || "Credenciales inválidas");
    }

    return {
      access_token: data.session.access_token,
      token_type: data.session.token_type,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      },
    };
  }

  /** Perfil del usuario autenticado. */
  async me(userToken) {
    const supabase = this.userClientFactory(userToken);
    const { data, error } = await supabase.auth.getUser(userToken);
    if (error || !data?.user) {
      throw new UnauthorizedError("Token inválido o expirado");
    }
    return data.user;
  }

  /** Actualiza metadatos o contraseña del usuario autenticado. */
  async update({ userToken, metadata, password }) {
    if (!metadata && !password) {
      throw new BadRequestError(
        "Debe enviarse al menos 'metadata' o 'password'"
      );
    }

    const supabase = this.userClientFactory(userToken);
    const body = {};
    if (metadata) body.data = metadata;
    if (password) body.password = password;

    const { data, error } = await supabase.auth.updateUser(body);
    if (error) throw error;
    return data.user;
  }
}

export default AuthService;
