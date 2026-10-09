export const ROUTES = {
    login: "/login",
    registro: "/registro",
    dashboard: "/dashboard",
  } as const;
  
  export const PUBLIC_ROUTES: string[] = [ROUTES.login, ROUTES.registro];
  export const HOME_AFTER_LOGIN = ROUTES.dashboard;
  export const SESSION_COOKIE = "session";
  
  export function isPublicRoute(pathname: string) {
    return PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
  }