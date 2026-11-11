import { DamagePage } from "../../damage/damage-page";

export const dynamic = "force-dynamic";

export default function NewMissingPage() {
  return <DamagePage kind="missing" />;
}
