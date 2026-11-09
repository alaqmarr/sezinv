import { connection } from "next/server";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader } from "@sezsec/ui";
import { ProfileEditorClient } from "./profile-editor.client";

export default async function MyProfilePage() {
  await connection();
  const user = await requireServerPageAccess("/profile");

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="My Profile"
        arabicBadge="ملفي الشخصي"
        subtitle="Manage your name, email address for verification codes, and sign-in password."
      />
      <ProfileEditorClient initialUser={user} />
    </div>
  );
}
