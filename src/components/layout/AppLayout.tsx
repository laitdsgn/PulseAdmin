import {
  Building2,
  ClipboardList,
  Flag,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Monitor,
  Moon,
  ScrollText,
  Sun,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { RoleBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n, type Lang, type MessageKey } from "@/i18n";
import { useAuth, useUser } from "@/lib/auth";
import { canAccess, type Area } from "@/lib/roles";
import { useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NAV: { area: Area; to: string; label: MessageKey; icon: LucideIcon }[] = [
  { area: "dashboard", to: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { area: "moderation", to: "/moderation", label: "nav.moderation", icon: Flag },
  { area: "reports", to: "/reports", label: "nav.reports", icon: ClipboardList },
  { area: "comments", to: "/comments", label: "nav.comments", icon: MessageSquare },
  { area: "places", to: "/places", label: "nav.places", icon: MapPin },
  { area: "city", to: "/city", label: "nav.city", icon: Building2 },
  { area: "users", to: "/users", label: "nav.users", icon: Users },
  { area: "audit", to: "/audit", label: "nav.audit", icon: ScrollText },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  const user = useUser();
  return (
    <nav className="flex flex-col gap-1 p-2" aria-label={t("nav.menu")}>
      {NAV.filter((item) => canAccess(user.role, item.area)).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent",
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
            )
          }
        >
          <Icon className="size-4" />
          {t(label)}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  const { t } = useI18n();
  return (
    <Link to="/" className="flex flex-col px-4 py-3">
      <span className="font-semibold">{t("app.name")}</span>
      <span className="text-xs text-muted-foreground">{t("app.tagline")}</span>
    </Link>
  );
}

const THEME_ICONS: Record<Theme, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

function UserMenu() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const user = useUser();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2">
          <UserRound className="size-4" />
          <span className="max-w-40 truncate">{user.username ?? user.displayName ?? `#${user.id}`}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="truncate">{user.username}</span>
          <RoleBadge role={user.role} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account">
            <UserRound className="size-4" />
            {t("nav.account")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t("nav.language")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={lang} onValueChange={(v) => setLang(v as Lang)}>
          <DropdownMenuRadioItem value="pl">Polski</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t("nav.theme")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          {(["light", "dark", "system"] as const).map((value) => {
            const Icon = THEME_ICONS[value];
            const label = value === "light" ? "nav.themeLight" : value === "dark" ? "nav.themeDark" : "nav.themeSystem";
            return (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon className="size-4" />
                {t(label)}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut className="size-4" />
          {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppLayout() {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <Brand />
        <Nav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("nav.menu")}>
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0">
              <SheetHeader className="p-0">
                <SheetTitle asChild>
                  <div>
                    <Brand />
                  </div>
                </SheetTitle>
              </SheetHeader>
              <Nav onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex-1" />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
