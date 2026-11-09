import { connection } from "next/server";
import { db } from "@sezsec/db";
import { canPerformAction } from "@sezsec/rbac/rbac.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { HallFloorPlanner } from "@sezsec/floor-plan";
import { listFloorPlans } from "@sezsec/floor-plan/floor-plan.service";
import { PageHeader } from "@sezsec/ui";

export default async function FloorPlanPage() {
  await connection();
  const user = await requireServerPageAccess("/events/floor-plan");
  const [halls, plans] = await Promise.all([
    db.hall.findMany({ orderBy: { name: "asc" } }),
    listFloorPlans(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hall Floor Layouts"
        subtitle="Arrange Thaals, stage, and counters to scale and share with bookers or decorators"
        arabicBadge="تخطيط القاعة"
      />
      <HallFloorPlanner
        halls={halls}
        initialPlans={plans}
        canEdit={canPerformAction("floor-plan:edit", user.role)}
      />
    </div>
  );
}
