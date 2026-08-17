import { PageHeader } from '@/components/PageHeader';
import { DailyChecklist } from '@/components/DailyChecklist';

export default function Checklist() {
  return (
    <div>
      <PageHeader
        title="Checklist do dia"
        subtitle="Tudo que precisa sair hoje, o que já saiu, e o que está atrasado — marca aqui conforme for postando."
      />
      <DailyChecklist fullPage />
    </div>
  );
}
