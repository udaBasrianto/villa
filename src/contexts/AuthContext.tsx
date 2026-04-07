import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface User {
  id: string;
  email?: string;
  role?: 'user' | 'admin';
  user_metadata?: {
    full_name?: string;
  };
}

interface Session {
  user: User;
  token: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, pass: string) => Promise<Session>;
  signUp: (email: string, pass: string, name: string) => Promise<Session>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  signIn: async () => {
    throw new Error("AuthProvider is missing");
  },
  signUp: async () => {
    throw new Error("AuthProvider is missing");
  },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  useEffect(() => {
    const savedSession = localStorage.getItem("auth_session");
    if (savedSession) {
      setSession(JSON.parse(savedSession));
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, pass: string) => {
    const response = await fetch(`${API_URL}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });

    const data: { token?: string; user?: User; message?: string } = await response.json();
    if (!response.ok || !data.token || !data.user) throw new Error(data.message || "Login gagal");

    const nextSession: Session = { token: data.token, user: data.user };
    setSession(nextSession);
    localStorage.setItem("auth_session", JSON.stringify(nextSession));
    localStorage.setItem("auth_token", data.token);
    return nextSession;
  };

  const signUp = async (email: string, pass: string, name: string) => {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass, name }),
    });

    const data: { token?: string; user?: User; message?: string } = await response.json();
    if (!response.ok || !data.token || !data.user) throw new Error(data.message || "Registrasi gagal");

    const nextSession: Session = { token: data.token, user: data.user };
    setSession(nextSession);
    localStorage.setItem("auth_session", JSON.stringify(nextSession));
    localStorage.setItem("auth_token", data.token);
    return nextSession;
  };

  const signOut = async () => {
    setSession(null);
    localStorage.removeItem("auth_session");
    localStorage.removeItem("auth_token");
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut, signIn, signUp }}>
      {children}
    </AuthContext.Provider>
  );
};
