import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import { mensagemErro } from "@/lib/erro-supabase";

export type ProfileStatus = "idle" | "loading" | "ready" | "missing" | "error";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type AppRole = "owner" | "admin" | "member";

/** Labels de exibição dos papéis (member = Comercial) */
export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Comercial",
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /** Papel do usuário na org atual (null enquanto carrega ou sem org) */
  role: AppRole | null;
  /** true para owner/admin — acesso total */
  isAdmin: boolean;
  loading: boolean;
  profileStatus: ProfileStatus;
  profileError: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  isAdmin: false,
  loading: true,
  profileStatus: "idle",
  profileError: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("idle");
  const [profileError, setProfileError] = useState<string | null>(null);
  const generation = useRef(0);
  const currentUser = useRef<string | null>(null);
  const invalidateProfile = useCallback(() => { ++generation.current; }, []);

  const startProfile = useCallback(() => {
    const next = ++generation.current;
    setLoading(true);
    setProfileStatus("loading");
    setProfileError(null);
    setProfile(null);
    setRole(null);
    return next;
  }, []);

  const loadProfile = useCallback(async (userId: string, request: number) => {
    const isCurrent = () => generation.current === request && currentUser.current === userId;
    if (!isCurrent()) return;
    try {
      // Convites continuam sendo aplicados antes de consultar perfil e papel.
      // A RPC é opcional em instalações ainda sem essa migration.
      try { await supabase.rpc("claim_pending_invitation"); } catch { /* segue a consulta */ }
      if (!isCurrent()) return;

      // O trigger pode ainda não ter criado o perfil após o cadastro.
      const delays = [0, 200, 500, 1000, 1500];
      let result: Profile | null = null;
      for (const delay of delays) {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        if (!isCurrent()) return;
        const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
        if (!isCurrent()) return;
        if (error) throw error;
        if (data) { result = data as Profile; break; }
      }

      if (!result) {
        setProfileStatus("missing");
        return;
      }
      let userRole: AppRole | null = null;
      if (result.org_id) {
        const { data, error } = await supabase.from("user_roles").select("role")
          .eq("user_id", userId).eq("org_id", result.org_id).maybeSingle();
        if (!isCurrent()) return;
        if (error) throw error;
        userRole = (data?.role as AppRole) ?? null;
      }
      if (!isCurrent()) return;
      setProfile(result);
      setRole(userRole);
      setProfileStatus("ready");
    } catch (error) {
      if (!isCurrent()) return;
      setProfileError(mensagemErro(error));
      setProfileStatus("error");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const initialGeneration = generation.current;
    const applySession = (nextSession: Session | null, defer: boolean) => {
      if (!active) return;
      currentUser.current = nextSession?.user.id ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        // Marcar loading e invalidar a geração anterior ANTES do callback adiado.
        const request = startProfile();
        if (defer) setTimeout(() => { void loadProfile(nextSession.user.id, request); }, 0);
        else void loadProfile(nextSession.user.id, request);
      } else {
        ++generation.current;
        setProfile(null);
        setRole(null);
        setProfileStatus("idle");
        setProfileError(null);
        setLoading(false);
      }
    };
    // Não executar consultas async dentro do callback de autenticação.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedEvent = true;
      applySession(nextSession, true);
    });
    void supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!receivedEvent && generation.current === initialGeneration) applySession(initialSession, false);
    }).catch(() => {
      if (active && !receivedEvent && generation.current === initialGeneration) applySession(null, false);
    });
    return () => {
      active = false;
      invalidateProfile();
      subscription.unsubscribe();
    };
  }, [loadProfile, startProfile, invalidateProfile]);

  const refreshProfile = useCallback(async () => {
    const userId = currentUser.current;
    if (!userId) return;
    await loadProfile(userId, startProfile());
  }, [loadProfile, startProfile]);

  const signOut = async () => {
    // Uma consulta em voo nunca deve reinstalar o perfil durante a saída.
    ++generation.current;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLoading(false);
      setProfileStatus("error");
      setProfileError(mensagemErro(error));
      throw error;
    }
    currentUser.current = null;
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setProfileStatus("idle");
    setProfileError(null);
    setLoading(false);
  };

  const isAdmin = role === "owner" || role === "admin";

  return (
    <AuthContext.Provider value={{ user, session, profile, role, isAdmin, loading, profileStatus, profileError, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
