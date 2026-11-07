import React, { Suspense } from "react";
import { connection } from "next/server";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader, Skeleton } from "@sezsec/ui";
import { ProfileEditorClient } from "./profile-editor.client";

async function MyProfileContent() {
  await connection();
  const user = await requireServerPageAccess("/profile");
  return <ProfileEditorClient initialUser={user} />;
}

export default function MyProfilePage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="My Profile"
        arabicBadge="ملفي الشخصي"
        subtitle="Manage your name, email address for verification codes, and sign-in password."
      />
      <Suspense
        fallback={
          <div className="space-y-5">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        <MyProfileContent />
      </Suspense>
    </div>
  );
}
