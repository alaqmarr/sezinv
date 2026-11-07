import React, { Suspense } from "react";
import { connection } from "next/server";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader, Skeleton } from "@sezsec/ui";
import { ProfileEditorClient } from "../profile/profile-editor.client";

async function CompleteProfileContent() {
  await connection();
  const user = await requireServerPageAccess("/complete-profile");
  return <ProfileEditorClient initialUser={user} onboardingMode />;
}

export default function CompleteProfilePage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Complete Your Contact Details"
        arabicBadge="إكمال البيانات"
        subtitle="Add your email address so we can send you 6-digit codes whenever you need to view booking charges."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <CompleteProfileContent />
      </Suspense>
    </div>
  );
}
