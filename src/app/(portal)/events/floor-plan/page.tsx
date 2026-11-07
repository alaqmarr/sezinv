import React, { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@sezsec/db";
import { canPerformAction } from "@sezsec/rbac/rbac.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { HallFloorPlanner } from "@sezsec/floor-plan";
import { listFloorPlans } from "@sezsec/floor-plan/floor-plan.service";
import { PageHeader, Skeleton } from "@sezsec/ui";

async function FloorPlanContent() {
  await connection();
  const user = await requireServerPageAccess("/events/floor-plan");
  const [halls, plans] = await Promise.all([
    db.hall.findMany({ orderBy: { name: "asc" } }),
    listFloorPlans(),
  ]);

  return (
    <HallFloorPlanner
      halls={halls}
      initialPlans={plans}
      canEdit={canPerformAction("floor-plan:edit", user.role)}
    />
  );
}

export default function FloorPlanPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Hall Floor Layouts"
        subtitle="Arrange Thaals, stage, and counters to scale and share with bookers or decorators"
        arabicBadge="تخطيط القاعة"
      />
      <Suspense fallback={<Skeleton className="h-[540px] w-full" />}>
        <FloorPlanContent />
      </Suspense>
    </div>
  );
}
