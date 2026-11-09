"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CalendarPlus,
  ClipboardList,
  FileSpreadsheet,
  History,
  LayoutGrid,
  LogOut,
  Map,
  Menu,
  Package,
  Settings,
  UserCircle,
  X,
} from "lucide-react";
import {
  cn,
  formatIST,
  getMisriDate,
  ROLE_LABELS,
} from "@sezsec/shared";
import { canAccessPage, useAuthSession } from "@sezsec/rbac";
import { AmountAccessBar } from "@sezsec/finance";
import { Badge } from "./badge.component";
import { Button } from "./button.component";
import { notify } from "./toast.helper";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Today & Overview", icon: LayoutGrid },
  { href: "/events", label: "Hall Bookings", icon: ClipboardList },
  { href: "/events/new", label: "New Booking", icon: CalendarPlus },
  { href: "/events/calendar", label: "Misri Calendar", icon: Calendar },
  { href: "/events/floor-plan", label: "Floor Layouts", icon: Map },
];

const STORE_NAV: NavItem[] = [
  { href: "/inventory", label: "Vessel Store", icon: Package },
  { href: "/lost-items", label: "Missing Items", icon: AlertCircle },
  { href: "/ledger", label: "Stock Register", icon: BookOpen },
];

const OFFICE_NAV: NavItem[] = [
  { href: "/logs", label: "Activity History", icon: History },
  { href: "/export-data", label: "Download Sheets", icon: FileSpreadsheet },
  { href: "/settings", label: "Office Settings", icon: Settings },
  { href: "/profile", label: "My Profile", icon: UserCircle },
];

export function PortalShell({
  todayIso,
  children,
}: {
  todayIso: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, amountUnlocked } = useAuthSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const todayMisri = getMisriDate(todayIso);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    notify.info("Signed out", "You have been signed out safely.");
    router.push("/login");
    router.refresh();
  };

  const renderSection = (title: string, items: NavItem[]) => {
    const visible = items.filter((item) => canAccessPage(item.href, user.role));
    if (visible.length === 0) return null;

    return (
      <div className="space-y-1">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8C7B73]">
          {title}
        </p>
        {visible.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href ||
                (item.href !== "/events" && pathname.startsWith(item.href));
          const exactEventsList =
            item.href === "/events" &&
            (pathname === "/events" ||
              (/^\/events\/[^/]+/.test(pathname) &&
                !pathname.startsWith("/events/new") &&
                !pathname.startsWith("/events/calendar") &&
                !pathname.startsWith("/events/floor-plan")));
          const isCurrent = active || exactEventsList;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                setMobileOpen(false);
                if (item.href === "/events/new") {
                  window.dispatchEvent(new Event("sezsec:reset-new-booking"));
                }
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isCurrent
                  ? "bg-[#6A1B1B] text-[#FAF7F2] shadow-xs"
                  : "text-[#4A3B36] hover:bg-[#F3EFE6] hover:text-[#231917]"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isCurrent ? "text-[#F5DFB0]" : "text-[#7B6B63]"
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    );
  };

  const renderSidebar = (showCloseButton = false) => (
    <div className="flex h-full flex-col justify-between border-r border-[#E5DDD0] bg-[#FAF7F2]">
      <div className="space-y-6 overflow-y-auto p-4">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[#D9C398] bg-white p-2.5 shadow-2xs"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/crest.png"
              alt="Anjuman-e-Mohammedi Crest"
              className="h-10 w-10 shrink-0 rounded-xl border border-[#EAE2D6] bg-[#FBF6EB] object-contain p-0.5"
            />
            <div className="min-w-0">
              <p
                dir="rtl"
                className="font-arabic truncate text-base leading-tight text-[#6A1B1B]"
              >
                انجمن محمدي سکندرآباد
              </p>
              <p className="truncate text-xs font-semibold text-[#231917]">
                Jamaat Events &amp; Store
              </p>
            </div>
          </Link>
          {showCloseButton ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="shrink-0 rounded-xl border border-[#DCD2C2] bg-white p-2 text-[#5E4F4A] hover:bg-[#EAE2D6] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <nav className="space-y-5">
          {renderSection("Bookings & Halls", PRIMARY_NAV)}
          {renderSection("Vessels & Store", STORE_NAV)}
          {renderSection("Office & Records", OFFICE_NAV)}
        </nav>
      </div>

      <div className="border-t border-[#E5DDD0] bg-white/85 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-[#231917]">
                {user.name || user.username}
              </p>
              <Badge tone="brass">{user.username}</Badge>
            </div>
            <p className="truncate text-xs text-[#7B6B63]">
              {ROLE_LABELS[user.role] || user.role}
            </p>
          </div>
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<LogOut className="h-3.5 w-3.5" />}
            onClick={handleLogout}
            title="Sign out"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="print-shell-reset flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden w-64 shrink-0 lg:block">
        <div className="sticky top-0 h-screen">{renderSidebar(false)}</div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen ? (
        <div className="no-print fixed inset-0 z-[90] flex lg:hidden">
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-[#1B1210]/45 backdrop-blur-[1px]"
          />
          <div className="relative z-10 h-full w-72 max-w-[85vw]">
            {renderSidebar(true)}
          </div>
        </div>
      ) : null}

      <div className="print-shell-reset flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="no-print sticky top-0 z-30 border-b border-[#E5DDD0] bg-white/90 backdrop-blur-md">
          <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="shrink-0 rounded-xl border border-[#DCD2C2] p-2 text-[#231917] lg:hidden cursor-pointer"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm">
                  <span className="font-semibold text-[#231917]">
                    {formatIST(todayIso, "EEEE, dd MMMM yyyy")}
                  </span>
                  <span className="hidden sm:inline text-[#C5B397]">•</span>
                  <span className="text-[#6E5D55]">{todayMisri.formattedEn}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                dir="rtl"
                className="font-arabic hidden md:inline text-lg text-[#6A1B1B]"
              >
                {todayMisri.formattedAr}
              </span>
              {user.canViewCharges ? (
                <AmountAccessBar unlocked={amountUnlocked} compact />
              ) : null}
            </div>
          </div>
        </header>

        {user.canViewCharges && !user.email ? (
          <div className="no-print border-b border-[#EED294] bg-[#FEF7E6] px-4 py-2 text-center text-xs text-[#925708]">
            Please add your email address in{" "}
            <Link href="/profile" className="font-bold underline">
              My Profile
            </Link>{" "}
            so we can send you 6-digit verification codes to view booking charges.
          </div>
        ) : null}

        <main className="print-shell-reset w-full flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
