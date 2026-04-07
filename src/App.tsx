import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import Index from "./pages/Index";
import VillaDetail from "./pages/VillaDetail";
import Bookings from "./pages/Bookings";
import SearchPage from "./pages/SearchPage";
import Favorites from "./pages/Favorites";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import { getApiUrl } from "@/lib/utils";

const queryClient = new QueryClient();

const ThemeSync = () => {
  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const API_URL = getApiUrl();
        const res = await fetch(`${API_URL}/villa-info`);
        const data = await res.json();
        if (data && data.theme_color) {
          document.documentElement.style.setProperty('--primary', data.theme_color);
          document.documentElement.style.setProperty('--ring', data.theme_color);
        }
        const appName = data?.app_name || data?.name;
        if (appName) {
          document.title = appName;
          const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
          if (ogTitle) ogTitle.content = appName;
          const twitterTitle = document.querySelector('meta[name="twitter:title"]') as HTMLMetaElement | null;
          if (twitterTitle) twitterTitle.content = appName;
        }

        const logoUrl = data?.app_logo_url;
        if (typeof logoUrl === "string" && logoUrl.trim()) {
          let iconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
          if (!iconLink) {
            iconLink = document.createElement("link");
            iconLink.rel = "icon";
            document.head.appendChild(iconLink);
          }
          iconLink.href = logoUrl;
        }
      } catch (error) {
        console.error("Failed to sync theme", error);
      }
    };
    fetchTheme();
  }, []);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <ThemeSync />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/villa/:id" element={<VillaDetail />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomNav />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
