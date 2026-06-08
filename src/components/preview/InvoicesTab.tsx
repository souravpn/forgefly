interface Invoice {
  client: string;
  service: string;
  amount: string;
  status: string;
  date?: string;
  number?: string;
}

interface InvoicesTabProps {
  invoices: Invoice[];
}

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s === 'paid') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
  if (s === 'outstanding' || s === 'unpaid') return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
  if (s === 'overdue') return 'bg-red-500/15 text-red-400 border-red-500/20';
  return 'bg-gray-500/15 text-gray-400 border-gray-500/20';
}

export default function InvoicesTab({ invoices }: InvoicesTabProps) {
  if (!invoices.length) {
    return <p className="text-sm text-gray-500 py-8 text-center">No invoices extracted.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/8">
            {['#', 'Client', 'Service', 'Date', 'Amount', 'Status'].map((col) => (
              <th
                key={col}
                className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium pb-3 pr-4 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
              <td className="py-3 pr-4 text-[12px] text-gray-500 whitespace-nowrap">
                {inv.number ?? `INV-${String(i + 1).padStart(3, '0')}`}
              </td>
              <td className="py-3 pr-4 text-[13px] font-[500] text-white whitespace-nowrap">{inv.client}</td>
              <td className="py-3 pr-4 text-[12px] text-gray-400 max-w-[160px] truncate">{inv.service}</td>
              <td className="py-3 pr-4 text-[12px] text-gray-500 whitespace-nowrap">{inv.date ?? '—'}</td>
              <td className="py-3 pr-4 text-[13px] font-[500] text-white whitespace-nowrap">{inv.amount}</td>
              <td className="py-3">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${statusClass(inv.status)}`}>
                  {inv.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
