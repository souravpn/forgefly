import { Info } from 'lucide-react';

interface Proposal {
  intro?: string;
  approach?: string;
  whyUs?: string;
  nextSteps?: string[];
}

interface ProposalsTabProps {
  proposal: Proposal;
  accentColor: string;
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium mb-2">{title}</p>
      <div className="text-[13px] text-gray-300 leading-[1.6]">{children}</div>
    </div>
  );
}

export default function ProposalsTab({ proposal, accentColor }: ProposalsTabProps) {
  const isEmpty = !proposal.intro && !proposal.approach && !proposal.whyUs && !proposal.nextSteps?.length;

  if (isEmpty) {
    return <p className="text-sm text-gray-500 py-8 text-center">No proposal template extracted.</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div
        className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-[12px]"
        style={{ background: `${accentColor}12`, border: `0.5px solid ${accentColor}30`, color: accentColor }}
      >
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>This template pre-populates for every proposal you send. Sign in to customise.</span>
      </div>

      {proposal.intro && (
        <SectionBlock title="Introduction">
          <p>{proposal.intro}</p>
        </SectionBlock>
      )}
      {proposal.approach && (
        <SectionBlock title="Our Approach">
          <p>{proposal.approach}</p>
        </SectionBlock>
      )}
      {proposal.whyUs && (
        <SectionBlock title="Why Us">
          <p>{proposal.whyUs}</p>
        </SectionBlock>
      )}
      {proposal.nextSteps && proposal.nextSteps.length > 0 && (
        <SectionBlock title="Next Steps">
          <ol className="space-y-1.5 list-none">
            {proposal.nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-[500] shrink-0 mt-0.5"
                  style={{ background: `${accentColor}20`, color: accentColor }}
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </SectionBlock>
      )}
    </div>
  );
}
