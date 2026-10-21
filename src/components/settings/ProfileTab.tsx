import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogoUploadField } from "@/components/crm/LogoUploadField";
import { useToast } from "@/hooks/use-toast";
import { mensagemErro } from "@/lib/erro-supabase";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Perfil pessoal: visível a QUALQUER papel. Antes morava em Geral, que só o
 * admin vê, e um funcionário não conseguia trocar o próprio nome.
 *
 * `profiles` não tem coluna de telefone; ele fica nos metadados do usuário
 * (auth), que o próprio usuário pode escrever sem migração.
 */
export function ProfileTab({ userId, profile }: { userId?: string; profile: Profile | null }) {
  const { toast } = useToast();
  const { user, refreshProfile } = useAuth();
  const [form, setForm] = useState({ name: "", title: "", timezone: "UTC", avatar: "", phone: "" });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const phone = (user?.user_metadata?.phone as string | undefined) ?? "";
    setForm({
      name: profile.name || "", title: profile.title || "", timezone: profile.timezone || "UTC",
      avatar: profile.avatar_url || "", phone,
    });
  }, [profile, user]);

  const salvar = async () => {
    if (!userId) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from("profiles").update({
        name: form.name, title: form.title, timezone: form.timezone, avatar_url: form.avatar || null,
      }).eq("id", userId);
      if (error) throw error;
      const { error: erroTel } = await supabase.auth.updateUser({ data: { phone: form.phone } });
      if (erroTel) throw erroTel;
      await refreshProfile();
      toast({ title: "Perfil atualizado" });
    } catch (e) {
      toast({ title: "Erro", description: mensagemErro(e), variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="vx-titulo-secao">Perfil</CardTitle>
        <CardDescription>Suas informações pessoais</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <LogoUploadField value={form.avatar} onChange={(avatar) => setForm({ ...form, avatar })} bucket="email-logos" rotulo="foto" redondo />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-xs" /></div>
          <div className="space-y-1"><Label className="text-xs">Cargo</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-8 text-xs" /></div>
          <div className="space-y-1"><Label className="text-xs">Telefone</Label><PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} className="h-8 text-xs" /></div>
          <div className="space-y-1">
            <Label className="text-xs">Fuso horário</Label>
            <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Sao_Paulo">São Paulo (BRT)</SelectItem>
                <SelectItem value="America/New_York">New York (EST)</SelectItem>
                <SelectItem value="Europe/London">London (GMT)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end"><Button size="sm" className="h-8 text-xs" onClick={salvar} disabled={salvando}>Salvar perfil</Button></div>
      </CardContent>
    </Card>
  );
}
