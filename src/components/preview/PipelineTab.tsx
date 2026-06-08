interface Lead {
  name: string;
  stage: string;
  value: string;
  service?: string;
}

interface PipelineTabProps {
  leads: Lead[];
  pipelineValue?: string;
  accentColor: string;
}

const STAGES = ['Prospect', 'Qualified', 'Proposal Sent', 'Negotiating', 'Closed Won'];

function stageColor(stage: string) {
  if (stage === 'Closed Won') return 'bg-emerald-500/15 text-emerald-400';
  if (stage === 'Negotiating') return 'bg-violet-500/15 text-violet-400';
  if (stage === 'Proposal Sent') return 'bg-blue-500/15 text-blue-400';
  if (stage === 'Qualified') return 'bg-amber-500/15 text-amber-400';
  return 'bg-gray-500/15 text-gray-400';
}

export default function PipelineTab({ leads, pipelineValue, accentColor }: PipelineTabProps) {
  return (
    <div>
      {pipelineValue && (
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium">Total pipeline</span>
          <span
            className="text-sm font-[500] px-2.5 py-0.5 rounded-full"
            style={{ background: `${accentColor}20`, color: accentColor }}
          >
            {pipelineValue}
          </span>
        </div>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage);
            return (
              <div key={stage} className="w-44">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium truncate">{stage}</p>
                  {stageLeads.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-1 shrink-0 ${stageColor(stage)}`}>
                      {stageLeads.length}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {stageLeads.map((lead, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-3 bg-white/5"
                      style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}
                    >
                      <p className="text-[12px] font-[500] text-white truncate">{lead.name}</p>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{lead.service}</p>
                      <p className="text-[12px] font-[500] mt-1" style={{ color: accentColor }}>
                        {lead.value}
                      </p>
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div
                      className="rounded-xl p-3 text-center"
                      style={{ border: '0.5px dashed rgba(255,255,255,0.1)' }}
                    >
                      <p className="text-[11px] text-gray-700">Empty</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-gray-600 mt-5 text-center">
        In the full portal, cards are draggable. Sign in to activate.
      </p>
    </div>
  );
}
