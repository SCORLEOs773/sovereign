import {
  POLICY_LIMITS,
  SPENDING_KEYS,
  computeBudget,
  type NationState,
  type SimState,
  type SpendingKey,
} from "@sovereign/shared";
import {
  formatMoney,
  formatPercent,
  formatRatio,
  formatSignedMoney,
} from "../format";
import { setPolicy } from "../sim/simClient";
import { LineChart } from "./LineChart";
import { PolicySlider } from "./PolicySlider";

const SPENDING_LABELS: Record<SpendingKey, string> = {
  health: "Healthcare",
  education: "Education",
  infrastructure: "Infrastructure",
  defence: "Defence",
  welfare: "Welfare",
};

function BudgetRow({
  label,
  amount,
  gdp,
  strong,
}: {
  label: string;
  amount: number;
  gdp: number;
  strong?: boolean;
}) {
  return (
    <div className={`brow ${strong ? "strong" : ""}`}>
      <span>{label}</span>
      <span>{formatMoney(amount)}</span>
      <span className="muted">{formatRatio(amount / gdp)}</span>
    </div>
  );
}

export function EconomyTab({
  state,
  nation,
}: {
  state: SimState;
  nation: NationState;
}) {
  const p = nation.policy;
  const b = nation.baseline;
  const budget = computeBudget(nation);
  const h = state.history;

  return (
    <div>
      <h4 className="group">Taxes</h4>
      <PolicySlider
        label="Income tax"
        value={p.incomeTax}
        baseline={b.incomeTax}
        min={POLICY_LIMITS.incomeTax.min}
        max={POLICY_LIMITS.incomeTax.max}
        step={0.005}
        onChange={(v) => setPolicy({ incomeTax: v })}
      />
      <PolicySlider
        label="Corporate tax"
        value={p.corporateTax}
        baseline={b.corporateTax}
        min={POLICY_LIMITS.corporateTax.min}
        max={POLICY_LIMITS.corporateTax.max}
        step={0.005}
        onChange={(v) => setPolicy({ corporateTax: v })}
      />

      <h4 className="group">Central bank</h4>
      <PolicySlider
        label="Interest rate"
        value={p.interestRate}
        baseline={b.interestRate}
        min={POLICY_LIMITS.interestRate.min}
        max={POLICY_LIMITS.interestRate.max}
        step={0.0025}
        onChange={(v) => setPolicy({ interestRate: v })}
      />
      <p className="muted small">
        Higher rates cool inflation and cut debt-free borrowing costs, but slow
        growth and raise unemployment.
      </p>

      <h4 className="group">Spending (share of GDP)</h4>
      {SPENDING_KEYS.map((key) => (
        <PolicySlider
          key={key}
          label={SPENDING_LABELS[key]}
          value={p.spending[key]}
          baseline={b.spending[key]}
          min={POLICY_LIMITS.spending.min}
          max={POLICY_LIMITS.spending.max}
          step={0.0025}
          onChange={(v) => setPolicy({ spending: { [key]: v } })}
        />
      ))}

      <h4 className="group">Annual budget projection</h4>
      <div className="budget">
        <BudgetRow label="Income tax" amount={budget.income} gdp={nation.gdp} />
        <BudgetRow
          label="Corporate tax"
          amount={budget.corporate}
          gdp={nation.gdp}
        />
        <BudgetRow
          label="Other revenue"
          amount={budget.other}
          gdp={nation.gdp}
        />
        <BudgetRow
          label="Total revenue"
          amount={budget.revenue}
          gdp={nation.gdp}
          strong
        />
        {SPENDING_KEYS.map((key) => (
          <BudgetRow
            key={key}
            label={SPENDING_LABELS[key]}
            amount={nation.gdp * p.spending[key]}
            gdp={nation.gdp}
          />
        ))}
        <BudgetRow
          label="Administration"
          amount={budget.administration}
          gdp={nation.gdp}
        />
        <BudgetRow
          label="Debt interest"
          amount={budget.interest}
          gdp={nation.gdp}
        />
        <BudgetRow
          label="Total spending"
          amount={budget.spending}
          gdp={nation.gdp}
          strong
        />
        <div className={`brow strong ${budget.balance >= 0 ? "ok" : "bad"}`}>
          <span>Balance</span>
          <span>{formatSignedMoney(budget.balance)}</span>
          <span>{formatRatio(budget.balance / nation.gdp)}</span>
        </div>
      </div>
      <p className="muted small">
        The treasury updates once a month. Deficits are borrowed, surpluses
        repay debt.
      </p>

      <h4 className="group">History</h4>
      <div className="charts">
        <LineChart title="GDP" values={h.gdp} format={formatMoney} />
        <LineChart
          title="Approval"
          values={h.approval}
          format={formatPercent}
          color="#3ddc97"
        />
        <LineChart
          title="Inflation"
          values={h.inflation}
          format={formatRatio}
          color="#e3b341"
        />
        <LineChart
          title="Unemployment"
          values={h.unemployment}
          format={formatRatio}
          color="#ff6b6b"
        />
        <LineChart
          title="Treasury"
          values={h.treasury}
          format={formatMoney}
          color="#5aa0c8"
        />
        <LineChart
          title="Debt"
          values={h.debt}
          format={formatMoney}
          color="#c9619b"
        />
      </div>
    </div>
  );
}
