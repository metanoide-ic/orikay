import { PageHeader } from '@/components/PageHeader';
import { DailyChecklist } from '@/components/DailyChecklist';
import { ChecklistCalendar } from '@/components/ChecklistCalendar';

export default function Checklist() {
  return (
    <div>
      <PageHeader
        title="Checklist do dia"
        subtitle="Tudo que precisa sair hoje, o que já saiu, e o que está atrasado — marca aqui conforme for postando."
      />
      <DailyChecklist fullPage />

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-white/70">Calendário do mês</h2>
        <ChecklistCalendar />
      </div>
    </div>
  );
}
