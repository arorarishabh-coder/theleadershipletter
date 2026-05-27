interface SectionRuleProps {
  label?: string;
}

export function SectionRule({ label }: SectionRuleProps) {
  if (!label) {
    return <hr className="my-12 border-t border-rule" />;
  }
  return (
    <div className="my-16 flex items-center gap-5">
      <span className="h-px flex-1 bg-rule" />
      <span className="font-mono text-[11px] uppercase tracking-dateline text-ink-faded">{label}</span>
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}
