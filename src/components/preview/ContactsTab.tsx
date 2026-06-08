interface Contact {
  name: string;
  company?: string;
  role?: string;
  status?: string;
}

interface ContactsTabProps {
  contacts: Contact[];
  accentColor: string;
}

function statusClass(status = '') {
  const s = status.toLowerCase();
  if (s.includes('active')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
  if (s.includes('prospect')) return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
  return 'bg-gray-500/15 text-gray-400 border-gray-500/20';
}

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function ContactsTab({ contacts, accentColor }: ContactsTabProps) {
  if (!contacts.length) {
    return <p className="text-sm text-gray-500 py-8 text-center">No contacts extracted.</p>;
  }

  return (
    <div className="space-y-2">
      {contacts.map((c, i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/[0.03] transition-colors"
          style={{ border: '0.5px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-[500] text-white shrink-0"
            style={{ background: `${accentColor}30`, color: accentColor }}
          >
            {getInitials(c.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-[500] text-white truncate">{c.name}</p>
            {(c.role || c.company) && (
              <p className="text-[11px] text-gray-500 truncate">
                {[c.role, c.company].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          {c.status && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${statusClass(c.status)}`}>
              {c.status}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
