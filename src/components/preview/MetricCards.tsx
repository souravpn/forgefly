import { Briefcase, DollarSign, TrendingUp, Users } from 'lucide-react';

interface Metrics {
  monthlyRevenue?: string;
  activeClients?: number;
  pipelineValue?: string;
  avgProjectValue?: string;
}

function renderMetricValue(value: string | number | undefined) {
  const str = value !== undefined && value !== null ? String(value) : null;
  if (!str) return <span>—</span>;
  if (str.startsWith('[estimated] ')) {
    const actual = str.replace('[estimated] ', '');
    return (
      <span>
        {actual}
        <span style={{ fontSize: 11, color: 'rgba(107,114,128,1)', marginLeft: 5, fontStyle: 'italic', fontWeight: 400 }}>
          est.
        </span>
      </span>
    );
  }
  return <span>{str}</span>;
}

interface MetricCardsProps {
  metrics: Metrics;
}

const CARDS = [
  { key: 'monthlyRevenue', label: 'Monthly Revenue', icon: DollarSign },
  { key: 'activeClients', label: 'Active Clients', icon: Users },
  { key: 'pipelineValue', label: 'Pipeline Value', icon: TrendingUp },
  { key: 'avgProjectValue', label: 'Avg. Project', icon: Briefcase },
] as const;

export default function MetricCards({ metrics }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {CARDS.map(({ key, label, icon: Icon }) => {
        const value = metrics[key];
        return (
          <div key={key} className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium">{label}</p>
              <Icon className="w-3.5 h-3.5 text-gray-600" />
            </div>
            <p className="text-[22px] font-[500] text-white leading-none">
              {renderMetricValue(value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
