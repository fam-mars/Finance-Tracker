import type { FinancialState } from "../domain/types";

interface PieChartProps {
  data: { label: string; value: number; color: string }[];
  width?: number;
  height?: number;
}

export function PieChart({ data, width = 240, height = 240 }: PieChartProps) {
  const radius = Math.min(width, height) / 2 - 20;
  const centerX = width / 2;
  const centerY = height / 2;

  const total = data.reduce((sum, d) => sum + Math.abs(d.value), 0);
  let currentAngle = -Math.PI / 2;
  const slices = data.map((d) => {
    const sliceAngle = (Math.abs(d.value) / total) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return { path, label: d.label, color: d.color, percent: ((d.value / total) * 100).toFixed(0) };
  });

  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flex: "0 0 auto" }}>
        {slices.map((slice, i) => (
          <path key={i} d={slice.path} fill={slice.color} stroke="white" strokeWidth="2" />
        ))}
      </svg>
      <div style={{ fontSize: "0.85rem", lineHeight: "1.6" }}>
        {slices.map((slice, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <div style={{ width: "12px", height: "12px", backgroundColor: slice.color, borderRadius: "2px" }} />
            <span>{slice.label}</span>
            <span style={{ marginLeft: "auto", fontWeight: 600 }}>{slice.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  width?: number;
  height?: number;
  maxValue?: number;
}

export function BarChart({ data, width = 280, height = 180, maxValue }: BarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.floor((width - 40) / data.length);
  const chartHeight = height - 40;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      {data.map((d, i) => {
        const barHeight = (Math.max(0, d.value) / max) * chartHeight;
        const x = 20 + i * barWidth + 5;
        const y = height - 20 - barHeight;

        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth - 10} height={barHeight} fill={d.color || "var(--teal)"} rx="3" />
            <text
              x={x + (barWidth - 10) / 2}
              y={height - 5}
              textAnchor="middle"
              fontSize="11"
              fill="var(--ink-soft)"
            >
              {d.label}
            </text>
            <text x={x + (barWidth - 10) / 2} y={y - 5} textAnchor="middle" fontSize="12" fill="var(--ink)" fontWeight="600">
              €{(d.value / 1000).toFixed(0)}k
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function CategoryBreakdown({ state }: { state: FinancialState }) {
  const categoryTotals: Record<string, number> = {};
  const colors: Record<string, string> = {
    Wonen: "#2d5e5c",
    Verzekeringen: "#5e8a88",
    Telecom: "#8cb5b3",
    Boodschappen: "#d4a574",
    Persoonlijk: "#c9a86f",
    Bankkosten: "#a0826d",
    Huishouden: "#8a7a6f",
    Abonnementen: "#8bc34a",
    Aflossingen: "#ff9800",
    Nutsvoorzieningen: "#2196f3",
  };

  state.fixedExpenses.forEach((exp) => {
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amountPerMonth;
  });

  const data = Object.entries(categoryTotals)
    .map(([label, value]) => ({
      label,
      value,
      color: colors[label] || "#999",
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div style={{ padding: "1rem", backgroundColor: "#f9f8f7", borderRadius: "8px" }}>
      <h3 style={{ margin: "0 0 1rem 0", fontSize: "0.95rem", fontWeight: 600 }}>Lasten per categorie</h3>
      <PieChart data={data} width={200} height={200} />
    </div>
  );
}

export function DebtSummary({ state }: { state: FinancialState }) {
  const mortgageDebt = state.debts.find((d) => d.linkedToMortgage);
  const otherDebts = state.debts.filter((d) => !d.linkedToMortgage);

  const data = [
    ...(mortgageDebt ? [{ label: mortgageDebt.description, value: mortgageDebt.principalRemaining, color: "#d32f2f" }] : []),
    ...otherDebts.map((d) => ({ label: d.description, value: d.principalRemaining, color: "#ff9800" })),
  ];

  if (data.length === 0) return null;

  return (
    <div style={{ padding: "1rem", backgroundColor: "#f9f8f7", borderRadius: "8px" }}>
      <h3 style={{ margin: "0 0 1rem 0", fontSize: "0.95rem", fontWeight: 600 }}>Schulden</h3>
      <BarChart data={data} width={280} height={160} />
    </div>
  );
}

export function IncomeExpenseComparison({ state }: { state: FinancialState }) {
  const totalIncome = state.incomes.reduce((sum, inc) => sum + inc.amountPerMonth, 0);
  const totalExpenses = state.fixedExpenses.reduce((sum, exp) => sum + exp.amountPerMonth, 0);
  const balance = totalIncome - totalExpenses;

  const data = [
    { label: "Inkomsten", value: totalIncome, color: "#4caf50" },
    { label: "Lasten", value: totalExpenses, color: "#f44336" },
  ];

  return (
    <div style={{ padding: "1rem", backgroundColor: "#f9f8f7", borderRadius: "8px" }}>
      <h3 style={{ margin: "0 0 1rem 0", fontSize: "0.95rem", fontWeight: 600 }}>Inkomsten vs Lasten</h3>
      <BarChart data={data} width={280} height={160} />
      <div style={{ marginTop: "1rem", padding: "0.75rem", backgroundColor: balance >= 0 ? "#e8f5e9" : "#ffebee", borderRadius: "4px" }}>
        <div style={{ fontSize: "0.85rem", color: balance >= 0 ? "#2e7d32" : "#c62828" }}>
          Maandelijks saldo: <strong>€{balance.toFixed(2)}</strong>
        </div>
      </div>
    </div>
  );
}
