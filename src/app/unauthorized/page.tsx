import Link from "next/link";
import { ShieldAlert, Home } from "lucide-react";
import { Button, KeelArchBanner } from "@sezsec/ui";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="jadwal-card w-full max-w-md rounded-3xl bg-white p-8 text-center">
        <KeelArchBanner
          arabicTitle="انجمن محمدي سکندرآباد"
          subtitle="Anjuman-e-Mohammedi, Secunderabad"
        />
        <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDF0F0] text-[#991B1B]">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-[#231917]">
          Page Restricted
        </h1>
        <p className="mt-2 text-sm text-[#5E4F4A]">
          Your account role does not have access to open this section. Please
          contact the Jamaat Office Administrator (Aziz Bhai Fakkad) if you need
          access.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button variant="primary" leftIcon={<Home className="h-4 w-4" />}>
              Go Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
