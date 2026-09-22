import { db } from "@/lib/db";
import { ensureCatalog, nairaFromKobo } from "@/lib/money";
import { Panel } from "@/components/admin/Ui";
import { saveBoost, savePlan, saveSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function CommercePage() {
  await ensureCatalog();
  const [settings, plans, boosts] = await Promise.all([
    db.platformSettings.findUnique({ where: { id: "default" } }),
    db.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } }),
    db.boostProduct.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Plans and money</h1>

      <Panel title="Referral settings">
        <form action={saveSettings} className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">1st payment %<input className="input mt-1" name="commissionPct1" type="number" defaultValue={settings?.commissionPct1 ?? 2} /></label>
          <label className="text-sm">2nd payment %<input className="input mt-1" name="commissionPct2" type="number" defaultValue={settings?.commissionPct2 ?? 2} /></label>
          <label className="text-sm">3rd payment %<input className="input mt-1" name="commissionPct3" type="number" defaultValue={settings?.commissionPct3 ?? 2} /></label>
          <label className="text-sm">Qualifying payments<input className="input mt-1" name="qualifyingPayments" type="number" defaultValue={settings?.qualifyingPayments ?? 3} /></label>
          <label className="text-sm">Min withdrawal (₦)<input className="input mt-1" name="minWithdrawalNaira" type="number" defaultValue={Math.round((settings?.minWithdrawalKobo ?? 500000) / 100)} /></label>
          <label className="text-sm">Hold hours<input className="input mt-1" name="holdHours" type="number" defaultValue={settings?.holdHours ?? 72} /></label>
          <button className="btn-primary sm:col-span-3 text-sm" type="submit">Save settings</button>
        </form>
      </Panel>

      <Panel title="Subscription plans">
        <div className="mt-4 space-y-4">
          {plans.map((plan) => (
            <form action={savePlan} key={plan.id} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-6">
              <input type="hidden" name="id" value={plan.id} />
              <input className="input" name="name" defaultValue={plan.name} />
              <input className="input" name="durationDays" type="number" defaultValue={plan.durationDays} />
              <input className="input" name="priceNaira" type="number" defaultValue={Math.round(plan.priceKobo / 100)} />
              <label className="text-xs">Active <input type="checkbox" name="active" defaultChecked={plan.active} /></label>
              <label className="text-xs">Public <input type="checkbox" name="publicVisible" defaultChecked={plan.publicVisible} /></label>
              <button className="rounded-lg border border-line text-sm" type="submit">Save</button>
              <p className="sm:col-span-6 text-xs text-muted">{plan.slug} · {nairaFromKobo(plan.priceKobo)}</p>
            </form>
          ))}
          <form action={savePlan} className="grid gap-2 rounded-xl border border-dashed border-line p-3 sm:grid-cols-6">
            <input className="input" name="slug" placeholder="slug" />
            <input className="input" name="name" placeholder="New plan name" />
            <input className="input" name="durationDays" type="number" placeholder="days" />
            <input className="input" name="priceNaira" type="number" placeholder="naira" />
            <input type="hidden" name="active" value="on" />
            <input type="hidden" name="publicVisible" value="on" />
            <button className="rounded-lg border border-line text-sm" type="submit">Add plan</button>
          </form>
        </div>
      </Panel>

      <Panel title="Boost packages">
        <div className="mt-4 space-y-4">
          {boosts.map((boost) => (
            <form action={saveBoost} key={boost.id} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-6">
              <input type="hidden" name="id" value={boost.id} />
              <input className="input" name="name" defaultValue={boost.name} />
              <input className="input" name="durationHours" type="number" defaultValue={boost.durationHours} />
              <input className="input" name="priceNaira" type="number" defaultValue={Math.round(boost.priceKobo / 100)} />
              <label className="text-xs">Active <input type="checkbox" name="active" defaultChecked={boost.active} /></label>
              <label className="text-xs">Public <input type="checkbox" name="publicVisible" defaultChecked={boost.publicVisible} /></label>
              <button className="rounded-lg border border-line text-sm" type="submit">Save</button>
            </form>
          ))}
          <form action={saveBoost} className="grid gap-2 rounded-xl border border-dashed border-line p-3 sm:grid-cols-6">
            <input className="input" name="slug" placeholder="slug" />
            <input className="input" name="name" placeholder="New boost name" />
            <input className="input" name="durationHours" type="number" placeholder="hours" />
            <input className="input" name="priceNaira" type="number" placeholder="naira" />
            <input type="hidden" name="active" value="on" />
            <input type="hidden" name="publicVisible" value="on" />
            <button className="rounded-lg border border-line text-sm" type="submit">Add boost</button>
          </form>
        </div>
      </Panel>
    </div>
  );
}
