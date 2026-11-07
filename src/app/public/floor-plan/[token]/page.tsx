import React, { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getPublicFloorPlanByToken } from "@sezsec/floor-plan/floor-plan.service";
import { Card, CardBody, CardHeader, KeelArchBanner, Skeleton } from "@sezsec/ui";

const PX_PER_FOOT = 10;

async function PublicFloorPlanContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await paramsPromise;
  const plan = await getPublicFloorPlanByToken(token);
  if (!plan) notFound();

  return (
    <div className="w-full space-y-6 px-4 py-8 sm:px-6 lg:px-10">
      <KeelArchBanner
        arabicTitle="انجمن محمدي سکندرآباد"
        subtitle="Shared Hall Arrangement Layout"
      />
      <Card accentTop>
        <CardHeader
          title={plan.name}
          subtitle={`${plan.hallName} • ${plan.width} ft × ${plan.length} ft (${plan.items.length} items)`}
        />
        <CardBody className="overflow-auto bg-[#F6F2EA] p-6">
          <div
            style={{
              width: `${plan.width * PX_PER_FOOT}px`,
              height: `${plan.length * PX_PER_FOOT}px`,
              backgroundSize: `${5 * PX_PER_FOOT}px ${5 * PX_PER_FOOT}px`,
              backgroundImage:
                "linear-gradient(to right, rgba(184,146,74,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(184,146,74,0.22) 1px, transparent 1px)",
            }}
            className="relative mx-auto rounded-lg border-2 border-[#6A1B1B] bg-white shadow-inner"
          >
            {plan.items.map((item) => (
              <div
                key={item.id}
                style={{
                  left: `${item.xFt * PX_PER_FOOT}px`,
                  top: `${item.yFt * PX_PER_FOOT}px`,
                  width: `${item.widthFt * PX_PER_FOOT}px`,
                  height: `${item.lengthFt * PX_PER_FOOT}px`,
                  backgroundColor: item.color,
                  transform: `rotate(${item.rotation}deg)`,
                }}
                className={`absolute flex items-center justify-center p-1 text-center text-[10px] font-semibold text-white shadow-sm ${
                  item.shape === "circle" ? "rounded-full" : "rounded-md"
                }`}
              >
                {item.label}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default function PublicFloorPlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="w-full px-4 py-8 sm:px-6 lg:px-10">
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <PublicFloorPlanContent paramsPromise={params} />
    </Suspense>
  );
}
