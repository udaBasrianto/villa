import { Home, Search, CalendarDays, Heart, User, LayoutDashboard } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const navItems = [
    { icon: Home, label: "Beranda", path: "/" },
    { icon: Search, label: "Cari", path: "/search" },
    { icon: CalendarDays, label: "Booking", path: "/bookings" },
    ...(user?.role === 'admin' ? [{ icon: LayoutDashboard, label: "Admin", path: "/admin" }] : [{ icon: Heart, label: "Favorit", path: "/favorites" }]),
    { icon: User, label: "Profil", path: "/profile" },
  ];

  // Hide on villa detail page
  if (location.pathname.startsWith("/villa/")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom md:hidden">
      <div className="bg-card/80 backdrop-blur-xl border-t border-border/50 shadow-[0_-8px_30px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around h-16">
          {navItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 ${
                  isActive
                    ? "text-primary scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 w-8 h-1 bg-primary rounded-b-full animate-in slide-in-from-top-1" />
                )}
                <Icon className={`w-5 h-5 transition-transform ${isActive ? "-translate-y-0.5" : ""}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] font-medium transition-all ${isActive ? "font-bold" : ""}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
