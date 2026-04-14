"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type UserType = "user" | "local";

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  fotoUrl?: string;
  telefono?: string | null;
  telefonoVerificado?: boolean;
  type: UserType;
  nombreLocal?: string;
  comuna?: string;
  cumpleDia?: number | null;
  cumpleMes?: number | null;
  codigoRef?: string;
  emailVerificado?: boolean;
}

export interface RegisterUserData {
  type: "user";
  nombre: string;
  email: string;
  password: string;
  comuna: string;
}

export interface RegisterLocalData {
  type: "local";
  nombreLocal: string;
  nombreEncargado: string;
  email: string;
  telefono: string;
  comuna: string;
  tipoCocina: string;
  password: string;
}

export type RegisterData = RegisterUserData | RegisterLocalData;

interface AuthResult {
  success: boolean;
  error?: string;
  userId?: string;
  alertaIP?: boolean;
  codigo?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<AuthResult>;
  register: (data: RegisterData) => Promise<AuthResult>;
  logout: () => void;
}

// ─── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login:    async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: () => {},
});

const SESSION_KEY = "quierocomer_session";

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        if (session.loggedIn) {
          setUser({
            id: session.id,
            nombre: session.nombre,
            email: session.email,
            fotoUrl: session.fotoUrl || "",
            telefono: session.telefono || null,
            type: session.tipo === "local" ? "local" : "user",
            cumpleDia: session.cumpleDia ?? null,
            cumpleMes: session.cumpleMes ?? null,
            codigoRef: session.codigoRef ?? "",
            emailVerificado: session.emailVerificado ?? false,
          });
        }
      }
    } catch { /* noop */ }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, tipo: "usuario" }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || "Email o contraseña incorrectos.", codigo: data.codigo };
      }

      const authUser: AuthUser = {
        id: data.data.id,
        nombre: data.data.nombre,
        email: data.data.email,
        fotoUrl: data.data.fotoUrl || "",
        telefono: data.data.telefono || null,
        telefonoVerificado: data.data.telefonoVerificado ?? false,
        type: "user",
        cumpleDia: data.data.cumpleDia ?? null,
        cumpleMes: data.data.cumpleMes ?? null,
        codigoRef: data.data.codigoRef ?? "",
        emailVerificado: data.data.emailVerificado ?? false,
      };

      // Cerrar sesión de local si existe
      localStorage.removeItem("quierocomer_local_session");
      sessionStorage.removeItem("quierocomer_local_session");

      setUser(authUser);
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        id: data.data.id,
        nombre: data.data.nombre,
        email: data.data.email,
        fotoUrl: data.data.fotoUrl || "",
        telefono: data.data.telefono || "",
        tipo: "usuario",
        loggedIn: true,
        cumpleDia: data.data.cumpleDia ?? null,
        cumpleMes: data.data.cumpleMes ?? null,
        codigoRef: data.data.codigoRef ?? "",
        estiloAlimentario: data.data.estiloAlimentario ?? "",
        comidasFavoritas: data.data.comidasFavoritas ?? [],
        emailVerificado: data.data.emailVerificado ?? false,
      }));

      // Sync birthday from BD to localStorage
      if (data.data.cumpleDia && data.data.cumpleMes) {
        localStorage.setItem("quierocomer_user_birthday", JSON.stringify({
          dia: data.data.cumpleDia,
          mes: data.data.cumpleMes,
          anio: data.data.cumpleAnio || null,
        }));
      } else {
        // No birthday in BD — remove any stale test data
        localStorage.removeItem("quierocomer_user_birthday");
      }

      return { success: true };
    } catch {
      return { success: false, error: "Error de conexión." };
    }
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<AuthResult> => {
    try {
      const nombre = data.type === "user" ? data.nombre : data.nombreEncargado;
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          email: data.email.trim().toLowerCase(),
          password: data.password,
          telefono: data.type === "local" ? data.telefono : null,
          ciudad: data.comuna || null,
          ...("refCode" in data && { refCode: (data as any).refCode }),
          ...("concursoId" in data && { concursoId: (data as any).concursoId }),
          ...("turnstileToken" in data && { turnstileToken: (data as any).turnstileToken }),
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        return { success: false, error: result.error || "Error al registrarse." };
      }

      const authUser: AuthUser = {
        id: result.id,
        nombre: result.nombre,
        email: result.email,
        type: "user",
      };

      setUser(authUser);
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        id: result.id,
        nombre: result.nombre,
        email: result.email,
        tipo: "usuario",
        loggedIn: true,
      }));

      return { success: true, userId: result.id, alertaIP: result.alertaIP };
    } catch {
      return { success: false, error: "Error de conexión." };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("quierocomer_user_birthday");
    localStorage.removeItem("quierocomer_local_session");
    sessionStorage.removeItem("quierocomer_local_session");
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
