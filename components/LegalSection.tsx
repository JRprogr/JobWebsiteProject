export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass flex flex-col gap-3 rounded-[22px] p-6 md:p-8">
      <h2 className="font-mono text-xs font-bold tracking-[0.12em]">[ {title} ]</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-7 text-dim [&_a]:text-fg [&_a]:underline [&_a]:underline-offset-4 [&_b]:font-bold [&_b]:text-fg">
        {children}
      </div>
    </section>
  );
}
