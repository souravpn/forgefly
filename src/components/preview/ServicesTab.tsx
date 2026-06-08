import { Check } from 'lucide-react';

interface Service {
  name: string;
  price: string;
  type?: string;
  description?: string;
  deliverables?: string[];
}

interface ServicesTabProps {
  services: Service[];
  accentColor: string;
}

function typeBadgeClass(type?: string) {
  if (type === 'retainer') return 'bg-violet-500/15 text-violet-400';
  if (type === 'hourly') return 'bg-amber-500/15 text-amber-400';
  return 'bg-blue-500/15 text-blue-400';
}

export default function ServicesTab({ services, accentColor }: ServicesTabProps) {
  if (!services.length) {
    return <p className="text-sm text-gray-500 py-8 text-center">No services extracted.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {services.map((svc, i) => {
        const isRetainer = svc.type === 'retainer';
        return (
          <div
            key={i}
            className="rounded-xl p-5 bg-white/5"
            style={{
              border: isRetainer
                ? `1.5px solid ${accentColor}40`
                : '0.5px solid rgba(255,255,255,0.1)',
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-sm font-[500] text-white leading-tight">{svc.name}</h3>
              {svc.type && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 capitalize font-medium ${typeBadgeClass(svc.type)}`}>
                  {svc.type}
                </span>
              )}
            </div>
            <p className="text-base font-[500] text-white mb-2">{svc.price}</p>
            {svc.description && (
              <p className="text-[12px] text-gray-400 leading-[1.6] mb-3 line-clamp-2">{svc.description}</p>
            )}
            {svc.deliverables && svc.deliverables.length > 0 && (
              <ul className="space-y-1">
                {svc.deliverables.slice(0, 4).map((d, di) => (
                  <li key={di} className="flex items-center gap-1.5 text-[12px] text-gray-400">
                    <Check className="w-3 h-3 text-gray-600 shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
