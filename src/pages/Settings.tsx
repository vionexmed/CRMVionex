/**
 * Configurações.
 *
 * A empresa é configurada UMA vez, pelo dono, e todo mundo herda — inclusive
 * as edições futuras. Por isso as abas de organização (Geral, Funis e etapas,
 * Campos, Assinatura, Plano) só aparecem para owner/admin.
 *
 * As abas pessoais (Notificações, Aparência) valem para qualquer papel. Antes a
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
import { BillingTab } from "@/components/settings/BillingTab";
import { PageTabs } from "@/components/layout/PageTabs";
import { Bell, CreditCard, FormInput, GitBranch, Palette, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/layout/PageShell";

const ABAS_PESSOAIS = ["notifications", "appearance"] as const;
const ABAS_ADMIN = [
  "general", "pipelines", "custom-fields", "email-signature", "notifications", "appearance", "billing",
] as const;

/** Grupos da navegação lateral. Os valores são os de `?aba=`, então links antigos seguem valendo.
 *  "Perfil" não tem aba própria: o perfil pessoal mora em Geral (só admin), e
 *  duplicar o item levaria à mesma tela com dois nomes. */
const GRUPOS = [
  {
    rotulo: "Você",
    itens: [
      { valor: "notifications", rotulo: "Notificações", admin: false },
      { valor: "appearance", rotulo: "Aparência", admin: false },
    ],
  },
  {
    rotulo: "Empresa",
    itens: [
      { valor: "general", rotulo: "Geral", admin: true },
      { valor: "pipelines", rotulo: "Funis e etapas", admin: true },
      { valor: "custom-fields", rotulo: "Campos personalizados", admin: true },
      { valor: "email-signature", rotulo: "Assinatura de e-mail", admin: true },
      { valor: "billing", rotulo: "Plano e cobrança", admin: true },
    ],
  },
] as const;

export default function Settings() {
  const { user, profile, isAdmin } = useAuth();
  const { orgId } = useOrg();

  // Abas pessoais valem para todos; as de organização só para admin. A lista de
  // válidas segue o papel, então `?aba=billing` de um funcionário cai no padrão.
  const validas = isAdmin ? ABAS_ADMIN : ABAS_PESSOAIS;
  const [aba, setAba] = useAbaNaUrl(
    "aba", isAdmin ? "general" : "notifications", validas,
  );
  const grupos = GRUPOS
    .map((g) => ({ ...g, itens: g.itens.filter((i) => isAdmin || !i.admin) }))
    .filter((g) => g.itens.length > 0);

  return (
    <PageShell
      title="Configurações"
      description="Seu perfil, a empresa e como o Vionex se parece para todo o time."
    >
      <Tabs value={aba} onValueChange={setAba} className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        {/* Celular/tablet: a barra horizontal de sempre (rola). Desktop: navegação agrupada. */}
        <div className="lg:hidden">
          <PageTabs
            abas={[
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
                          "flex min-h-8 w-full items-center rounded-md px-3 text-left text-sm transition-colors",
                          ativo ? "bg-accent font-semibold text-accent-foreground" : "text-foreground hover:bg-muted",
                        )}
                      >
                        {item.rotulo}
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
                <GeneralTab orgId={orgId} userId={user?.id} profile={profile} />
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
