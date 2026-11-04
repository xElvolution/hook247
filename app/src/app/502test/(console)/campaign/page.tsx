import { adminCampaignSnapshot } from "@/lib/welcome";
import { Panel, Badge } from "@/components/admin/Ui";
import { markIdentityPassed, saveWelcomeCampaign, setWelcomeReferral, voidWelcomeReward } from "./actions";

export const dynamic = "force-dynamic";

function naira(kobo: number) {
  return `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}

export default async function CampaignPage() {
  const data = await adminCampaignSnapshot();
  const { settings } = data;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Welcome reward</h1>
        <p className="mt-1 text-sm text-muted">
          {data.issued} of {settings.participantLimit} issued · {naira(data.issuedKobo)} issued · {naira(data.withdrawnKobo)} withdrawn
        </p>
      </div>
      <Panel title="Campaign settings">
        <form action={saveWelcomeCampaign} className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs text-muted">
            Participant limit
            <input name="participantLimit" type="number" min={1} defaultValue={settings.participantLimit} className="input mt-1 w-full" />
          </label>
          <label className="text-xs text-muted">
            Reward (naira)
            <input name="rewardNaira" type="number" min={1} defaultValue={Math.round(settings.rewardKobo / 100)} className="input mt-1 w-full" />
          </label>
          <label className="text-xs text-muted">
            Verified referrals required
            <input name="requiredReferrals" type="number" min={1} defaultValue={settings.requiredReferrals} className="input mt-1 w-full" />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} />
            Campaign enabled
          </label>
          <div className="sm:col-span-4">
            <button type="submit" className="btn-primary !py-2 text-sm">Save campaign</button>
          </div>
        </form>
      </Panel>
      <Panel title="Participants">
        {data.rows.length === 0 ? <p className="text-sm text-muted">No rewards issued yet. Registration alone does not qualify.</p> : null}
        <div className="space-y-4">
          {data.rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{row.name}</strong>
                <span className="text-xs text-muted">{row.email}</span>
                <Badge>{row.status}</Badge>
                <span className="text-xs text-muted">{naira(row.amountKobo)} · slot {row.slot} · {row.qualified} qualified · code {row.code}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {row.status !== "WITHDRAWN" && row.status !== "VOID" ? (
                  <form action={voidWelcomeReward}>
                    <input type="hidden" name="userId" value={row.userId} />
                    <button type="submit" className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300">Void reward</button>
                  </form>
                ) : null}
                <form action={markIdentityPassed}>
                  <input type="hidden" name="userId" value={row.userId} />
                  <button type="submit" className="rounded border border-line px-2 py-1 text-xs">Record face verification</button>
                </form>
              </div>
              <ul className="mt-3 space-y-2 text-xs">
                {row.referrals.map((ref) => (
                  <li key={ref.id} className="rounded-lg border border-line/70 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{ref.name}</strong>
                      <Badge tone={ref.qualified ? "good" : ref.rejected ? "bad" : "warn"}>{ref.overall}</Badge>
                    </div>
                    <p className="mt-1 text-muted">{ref.steps}</p>
                    <form action={setWelcomeReferral} className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="referrerId" value={row.userId} />
                      <input type="hidden" name="referredId" value={ref.id} />
                      <input type="hidden" name="rejected" value={ref.rejected ? "0" : "1"} />
                      <input name="note" placeholder="Note" className="input !py-1 text-xs" />
                      <button type="submit" className="rounded border border-line px-2 py-1">{ref.rejected ? "Allow referral" : "Reject referral"}</button>
                    </form>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
