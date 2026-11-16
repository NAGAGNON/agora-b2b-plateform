import { PageHeader } from "@/components/ui";
import { SimulatorPanel } from "@/components/simulator";

export default function Page() {
  return (
    <div>
      <PageHeader title="Simulateur de rentabilité" sub="Calcul exact, sans IA : coût total → bénéfice net → marge, comparés à vos seuils et budgets." />
      <SimulatorPanel />
    </div>
  );
}
