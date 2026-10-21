/**
 * Configurações.
 *
 * A empresa é configurada UMA vez, pelo dono, e todo mundo herda — inclusive
 * as edições futuras. Por isso as abas de organização (Geral, Funis e etapas,
 * Campos, Assinatura, Plano) só aparecem para owner/admin.
 *
 * As abas pessoais (Perfil, Notificações, Aparência, Design system) valem para qualquer papel. Antes a
 * página inteira estava atrás de RequireAdmin, então um funcionário não conseguia
 * nem trocar o próprio tema.
 */
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/hooks/useOrg";
import { useAbaNaUrl } from "@/hooks/useAbaNaUrl";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Mail } from "lucide-react";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { PipelinesTab } from "@/components/settings/PipelinesTab";
import { CustomFieldsTab } from "@/components/settings/CustomFieldsTab";
import { EmailSignatureTab } from "@/components/settings/EmailSignatureTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { AppearanceTab } from "@/components/settings/AppearanceTab";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { DesignSystemTab } from "@/components/settings/DesignSystemTab";
import { BillingTab } from "@/components/settings/BillingTab";
import { PageTabs } from "@/components/layout/PageTabs";
import { Bell, CreditCard, FormInput, GitBranch, Layers, Palette, SlidersHorizontal, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/layout/PageShell";

/** Perfil, Notificações, Aparência e Design system valem para qualquer papel. */
const ABAS_PESSOAIS = ["profile", "notifications", "appearance", "design-system"] as const;
const ABAS_ADMIN = [
  "profile", "general", "pipelines", "custom-fields", "email-signature", "notifications", "appearance", "billing", "design-system",
] as const;

/** Grupos da navegação lateral. Os valores são os de `?aba=`, então links antigos seguem valendo. */
const GRUPOS = [
  {
    rotulo: "Você",
    itens: [
      { valor: "profile", rotulo: "Perfil", admin: false, novo: false },
      { valor: "notifications", rotulo: "Notificações", admin: false, novo: false },
      { valor: "appearance", rotulo: "Aparência", admin: false, novo: false },
    ],
  },
  {
    rotulo: "Empresa",
    itens: [
      { valor: "general", rotulo: "Geral", admin: true, novo: false },
      { valor: "pipelines", rotulo: "Funis e etapas", admin: true, novo: false },
      { valor: "custom-fields", rotulo: "Campos personalizados", admin: true, novo: false },
      { valor: "email-signature", rotulo: "Assinatura de e-mail", admin: true, novo: false },
      { valor: "billing", rotulo: "Plano e cobrança", admin: true, novo: false },
    ],
  },
  {
    rotulo: "Sistema",
    itens: [{ valor: "design-system", rotulo: "Design system", admin: false, novo: true }],
  },
] as const;

export default function Settings() {
  const { user, profile, isAdmin } = useAuth();
  const { orgId } = useOrg();

  // Abas pessoais valem para todos; as de organização só para admin. A lista de
  // válidas segue o papel, então `?aba=billing` de um funcionário cai no padrão.
  const validas = isAdmin ? ABAS_ADMIN : ABAS_PESSOAIS;
  const [aba, setAba] = useAbaNaUrl(
    "aba", "profile", validas,
  );
  const grupos = GRUPOS
    .map((g) => ({ ...g, itens: g.itens.filter((i) => isAdmin || !i.admin) }))
    .filter((g) => g.itens.length > 0);

  return (
    <PageShell
      // A referência desta tela começa 11px acima das demais (sem o respiro do cabeçalho).
      className="md:-mt-[11px]"
      title="Configurações"
      description="Seu perfil, a empresa e como o Vionex se parece para todo o time."
    >
      <Tabs value={aba} onValueChange={setAba} className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        {/* Celular/tablet: a barra horizontal de sempre (rola). Desktop: navegação agrupada. */}
        <div className="lg:hidden">
          <PageTabs
            abas={[
              { valor: "profile", rotulo: "Perfil", icone: User },
              ...(isAdmin
                ? [
                    { valor: "general", rotulo: "Geral", icone: SlidersHorizontal },
                    { valor: "pipelines", rotulo: "Funis e etapas", icone: GitBranch, rotuloCurto: "Funis" },
                    { valor: "custom-fields", rotulo: "Campos", icone: FormInput },
                    { valor: "email-signature", rotulo: "Assinatura", icone: Mail },
                  ]
                : []),
              { valor: "notifications", rotulo: "Notificações", icone: Bell, rotuloCurto: "Notif." },
              { valor: "appearance", rotulo: "Aparência", icone: Palette },
              ...(isAdmin ? [{ valor: "billing", rotulo: "Plano", icone: CreditCard }] : []),
              { valor: "design-system", rotulo: "Design system", icone: Layers, rotuloCurto: "Design" },
            ]}
          />
        </div>

        <nav aria-label="Seções de configurações" className="hidden rounded-lg border border-border bg-card p-3 lg:block">
          {grupos.map((g, i) => (
            <div key={g.rotulo} className={cn(i > 0 && "mt-4")}>
              <p className="px-3 pb-1.5 pt-1 text-label font-semibold uppercase tracking-wider text-muted-foreground">{g.rotulo}</p>
              <ul className="space-y-0.5">
                {g.itens.map((item) => {
                  const ativo = aba === item.valor;
                  return (
                    <li key={item.valor}>
                      <button
                        type="button"
                        onClick={() => setAba(item.valor)}
                        aria-current={ativo ? "page" : undefined}
                        className={cn(
                          "flex min-h-[34px] w-full items-center justify-between rounded-md px-3 text-left text-sm transition-colors",
                          ativo ? "bg-accent font-semibold text-accent-foreground" : "text-foreground hover:bg-muted",
                        )}
                      >
                        {item.rotulo}
                        {item.novo && <span className="vx-selo-nav rounded-full bg-primary px-2 py-1 font-bold uppercase tracking-wide text-primary-foreground">Novo</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          {isAdmin && (
            <>
              <TabsContent value="general" className="mt-0">
                <GeneralTab orgId={orgId} />
              </TabsContent>
              <TabsContent value="pipelines" className="mt-0">
                <PipelinesTab orgId={orgId} />
              </TabsContent>
              <TabsContent value="custom-fields" className="mt-0">
                <CustomFieldsTab orgId={orgId} />
              </TabsContent>
              <TabsContent value="email-signature" className="mt-0">
                <EmailSignatureTab orgId={orgId} />
              </TabsContent>
              <TabsContent value="billing" className="mt-0">
                <BillingTab orgId={orgId} />
              </TabsContent>
            </>
          )}
          <TabsContent value="profile" className="mt-0">
            <ProfileTab userId={user?.id} profile={profile} />
          </TabsContent>
          <TabsContent value="design-system" className="mt-0">
            <DesignSystemTab />
          </TabsContent>
          <TabsContent value="notifications" className="mt-0">
            <NotificationsTab orgId={orgId} userId={user?.id} />
          </TabsContent>
          <TabsContent value="appearance" className="mt-0">
            <AppearanceTab />
          </TabsContent>
        </div>
      </Tabs>
    </PageShell>
  );
}
