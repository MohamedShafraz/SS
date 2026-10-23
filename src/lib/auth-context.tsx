"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/types";
import { isAuthUser, isLoginResponse, readMessage } from "./contracts";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  setDemoMode: (isDemo: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthContext };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setDemoMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        const data: unknown = await response.json();
        const sessionUser = data && typeof data === "object" ? (data as { user?: unknown }).user : null;
        if (response.ok && isAuthUser(sessionUser)) {
          setUser(sessionUser);
          setToken("authenticated");
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readMessage(data, "Login failed"));
      }

      if (!isLoginResponse(data)) {
        throw new Error("Login response was not valid");
      }
      
      setToken(data.token);
      setUser(data.user);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
    setUser(null);
    setToken(null);
    router.push("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isDemoMode,
        setDemoMode,
        isAuthenticated: !!user && !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
