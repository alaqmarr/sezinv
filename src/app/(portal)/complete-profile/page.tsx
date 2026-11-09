import { connection } from "next/server";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader } from "@sezsec/ui";
import { ProfileEditorClient } from "../profile/profile-editor.client";

export default async function CompleteProfilePage() {
  await connection();
  const user = await requireServerPageAccess("/complete-profile");

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Complete Your Contact Details"
        arabicBadge="إكمال البيانات"
        subtitle="Add your email address so we can send you 6-digit codes whenever you need to view booking charges."
      />
      <ProfileEditorClient initialUser={user} onboardingMode />
    </div>
  );
}
