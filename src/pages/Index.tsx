import { useState, useEffect } from "react";
import { Search, User, LogIn, MapPin, Star, Bed, Users, CalendarCheck, CloudSun, Clock, Calendar as CalendarIcon, ChevronRight, Quote, Wifi, Coffee, Sparkles, Waves, ParkingCircle, ShieldCheck, TreePine, ChefHat, List, Grid2X2, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Room, VillaInfo } from "@/data/villas";
import { useAuth } from "@/contexts/AuthContext";
import RoomCard from "@/components/RoomCard";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn, getApiUrl } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [villaData, setVillaData] = useState<VillaInfo | null>(null);
  const [stats, setStats] = useState<{ totalUsers: number; totalBookings: number; totalRooms: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [userTempC, setUserTempC] = useState<number | null>(null);
  const [timeText, setTimeText] = useState(() => format(new Date(), "HH:mm"));

  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobilePackageView, setMobilePackageView] = useState<"carousel" | "list" | "grid2">("carousel");

  const API_URL = getApiUrl();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const update = () => setTimeText(format(new Date(), "HH:mm"));
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const onSuccess: PositionCallback = async (pos) => {
      const latitude = pos.coords.latitude;
      const longitude = pos.coords.longitude;

      try {
        const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
        weatherUrl.searchParams.set("latitude", String(latitude));
        weatherUrl.searchParams.set("longitude", String(longitude));
        weatherUrl.searchParams.set("current", "temperature_2m");
        weatherUrl.searchParams.set("timezone", "auto");

        const res = await fetch(weatherUrl.toString());
        if (res.ok) {
          const data = (await res.json()) as { current?: { temperature_2m?: number } };
          const temp = data?.current?.temperature_2m;
          if (typeof temp === "number" && Number.isFinite(temp)) {
            setUserTempC(Math.round(temp));
          }
        }
      } catch {
        setUserTempC(null);
      }

      try {
        const geoUrl = new URL("https://nominatim.openstreetmap.org/reverse");
        geoUrl.searchParams.set("format", "jsonv2");
        geoUrl.searchParams.set("lat", String(latitude));
        geoUrl.searchParams.set("lon", String(longitude));
        geoUrl.searchParams.set("zoom", "10");
        geoUrl.searchParams.set("addressdetails", "1");

        const res = await fetch(geoUrl.toString(), {
          headers: {
            "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
          },
        });
        if (!res.ok) {
          setUserLocation("Lokasi Anda");
          return;
        }

        const data = (await res.json()) as {
          address?: {
            city?: string;
            town?: string;
            village?: string;
            state?: string;
            county?: string;
            country?: string;
          };
        };
        const address = data?.address;
        const city =
          address?.city || address?.town || address?.village || address?.county || address?.state || address?.country;
        setUserLocation(city ? city : "Lokasi Anda");
      } catch {
        setUserLocation("Lokasi Anda");
      }
    };

    const onError: PositionErrorCallback = () => {
      setUserLocation(null);
      setUserTempC(null);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 10 * 60 * 1000,
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [roomsRes, villaRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/rooms`),
          fetch(`${API_URL}/villa-info`),
          fetch(`${API_URL}/stats`)
        ]);
        
        if (!roomsRes.ok || !villaRes.ok) {
          throw new Error("Gagal mengambil data dari server");
        }

        const roomsData = await roomsRes.json();
        const villaData = await villaRes.json();
        const statsData = statsRes.ok ? await statsRes.json() : null;
        
        setRooms(roomsData);
        setVillaData(villaData);
        setStats(statsData);
      } catch (error) {
        console.error("Gagal mengambil data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [API_URL]);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.append("q", searchQuery);
    if (checkIn) params.append("checkin", checkIn.toISOString());
    if (checkOut) params.append("checkout", checkOut.toISOString());
    if (onlyAvailable) params.append("available", "true");
    
    navigate(`/search?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!villaData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-5 text-center">
        <h2 className="text-xl font-bold text-foreground mb-2">Oops! Ada masalah</h2>
        <p className="text-muted-foreground mb-4">Gagal memuat informasi villa. Pastikan server sudah berjalan.</p>
        <Button onClick={() => window.location.reload()}>Coba Lagi</Button>
      </div>
    );
  }

  const brandName = villaData.app_name || "VILLAPARA";
  const logoUrl = villaData.app_logo_url;
  const locationLabel = (userLocation || villaData.location || "Ubud, Bali").toUpperCase();
  const temperatureLabel = `${userTempC ?? 28}°C`;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      {/* Sticky Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 md:px-12 py-4 flex items-center justify-between ${
          scrolled
            ? "bg-background/80 backdrop-blur-xl border-b border-border py-3"
            : "bg-transparent"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="w-5 h-5 object-contain" />
            ) : (
              <Bed className="w-5 h-5 text-primary-foreground" />
            )}
          </div>
          <span className={`font-black text-lg tracking-tight transition-colors ${scrolled ? "text-foreground" : "text-white"}`}>
            {brandName}
          </span>
        </div>
        
        <button
          onClick={() => navigate(user ? "/profile" : "/auth")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
            scrolled 
              ? "bg-card border-border text-foreground shadow-sm" 
              : "bg-white/10 backdrop-blur-md border-white/20 text-white"
          }`}
        >
          {user && (
            <span className="text-xs font-bold truncate max-w-[80px]">
              {user.user_metadata?.full_name?.split(" ")[0] || "User"}
            </span>
          )}
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${scrolled ? "bg-primary/10" : "bg-white/20"}`}>
            {user ? <User className={`w-4 h-4 ${scrolled ? "text-primary" : "text-white"}`} /> : <LogIn className="w-4 h-4" />}
          </div>
        </button>
      </header>

      {/* Hero Section */}
      <div className="relative h-[560px] sm:h-[600px] md:h-[650px] overflow-hidden">
        <Carousel
          plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
          className="w-full h-full absolute inset-0"
          opts={{ loop: true }}
        >
          <CarouselContent className="h-full">
            {rooms.map((room) => (
              <CarouselItem key={room.id} className="h-full">
                <div className="w-full h-full overflow-hidden relative">
                  <img
                    src={room.image}
                    alt={room.name}
                    className="w-full h-full object-cover transition-transform duration-[20000ms] hover:scale-110"
                    style={{ transformOrigin: "center center" }}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-4 sm:px-10 pointer-events-none z-20">
            <CarouselPrevious className="pointer-events-auto static translate-x-0 translate-y-0 bg-white/20 hover:bg-white/40 border-none text-white h-10 w-10 sm:h-12 sm:w-12 backdrop-blur-md" />
            <CarouselNext className="pointer-events-auto static translate-x-0 translate-y-0 bg-white/20 hover:bg-white/40 border-none text-white h-10 w-10 sm:h-12 sm:w-12 backdrop-blur-md" />
          </div>
        </Carousel>

        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.8) 100%)" }}
        />
        
        <div className="absolute inset-0 flex flex-col justify-end px-6 pb-6 pt-24 sm:pt-28 md:p-12 lg:p-20">
          {/* Welcome Widget */}
          <div className="flex items-center gap-3 mb-4 animate-fade-in flex-wrap">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-2xl flex items-center gap-2">
              <CloudSun className="w-4 h-4 text-accent" />
              <span className="text-white text-[11px] font-bold tracking-wide uppercase">{temperatureLabel} {locationLabel}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-2xl flex items-center gap-2">
              <Clock className="w-4 h-4 text-white" />
              <span className="text-white text-[11px] font-bold tracking-wide uppercase">{timeText}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-2">
            <div className="bg-primary/90 text-primary-foreground text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider">
              Official Villa
            </div>
            <div className="flex items-center gap-1 bg-card/20 backdrop-blur-sm px-2 py-0.5 rounded-full text-white text-[10px] font-bold">
              <Star className="w-3 h-3 text-accent fill-accent" />
              {villaData.rating}
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-white leading-tight drop-shadow-sm">
            {villaData.name}
          </h1>
          
          <div className="flex items-center gap-1.5 text-white/90 text-sm mt-1.5 sm:mt-2 font-medium">
            <MapPin className="w-4 h-4 shrink-0 text-primary" />
            <span>{villaData.location}</span>
          </div>

          {/* Search Card */}
          <div className="mt-5 sm:mt-6 md:mt-8 bg-card/40 backdrop-blur-3xl rounded-[2rem] p-4 sm:p-5 md:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] w-full max-w-4xl border border-white/30 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              
              {/* Search Input */}
              <div className="md:col-span-4 space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/90 ml-1">Tipe Kamar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
                  <input
                    type="text"
                    placeholder="Cari tipe kamar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 text-white rounded-2xl py-2.5 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/50 transition-all outline-none font-medium placeholder:text-white/50"
                  />
                </div>
              </div>

              {/* Date Pickers */}
              <div className="md:col-span-5 grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-white/90 ml-1">Check-in</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-medium text-xs h-[42px] rounded-2xl bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white transition-all",
                          !checkIn && "text-white/60"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-white/80" />
                        {checkIn ? format(checkIn, "dd MMM yyyy", { locale: id }) : <span>Tanggal</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-3xl overflow-hidden" align="start">
                      <Calendar mode="single" selected={checkIn} onSelect={setCheckIn} initialFocus locale={id} />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-white/90 ml-1">Check-out</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-medium text-xs h-[42px] rounded-2xl bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white transition-all",
                          !checkOut && "text-white/60"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-white/80" />
                        {checkOut ? format(checkOut, "dd MMM yyyy", { locale: id }) : <span>Tanggal</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-3xl overflow-hidden" align="start">
                      <Calendar mode="single" selected={checkOut} onSelect={setCheckOut} initialFocus locale={id} disabled={(date) => (checkIn ? date < checkIn : false)} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Action Button & Toggle */}
              <div className="md:col-span-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <Checkbox 
                    id="available" 
                    checked={onlyAvailable}
                    onCheckedChange={(checked) => setOnlyAvailable(checked === true)}
                    className="h-3.5 w-3.5 rounded-[4px] border-white/40 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary"
                  />
                  <Label htmlFor="available" className="text-[10px] font-bold text-white/90 cursor-pointer select-none">
                    Kamar Kosong Saja
                  </Label>
                </div>
                <Button 
                  onClick={handleSearch}
                  className="w-full rounded-2xl h-[42px] font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all group border-none"
                >
                  Cari Sekarang
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

            </div>
          </div>
          
          {/* Quick Facility Chips */}
          <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide w-full max-w-4xl animate-in fade-in slide-in-from-bottom-3 duration-1000 delay-300">
            {[
              { icon: Sparkles, label: "Top Rated" },
              { icon: Wifi, label: "Free WiFi" },
              { icon: Coffee, label: "Breakfast" },
              { icon: MapPin, label: "Center" },
            ].map((chip, idx) => (
              <div key={idx} className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full whitespace-nowrap shrink-0">
                <chip.icon className="w-3 h-3 text-white" />
                <span className="text-white text-[10px] font-bold tracking-wider uppercase">{chip.label}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Villa Description */}
      <section className="px-6 md:px-12 lg:px-20 mt-12">
        <h2 className="text-2xl font-bold text-foreground">Tentang Villa</h2>
        <p className="text-muted-foreground text-base mt-4 leading-relaxed max-w-4xl">
          {villaData.description}
        </p>
      </section>

      {/* Stats Cards Section */}
      <section className="px-6 md:px-12 lg:px-20 mt-12">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-6 px-6 pr-10 md:pr-0 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:gap-6 snap-x snap-mandatory md:snap-none touch-pan-x">
          <div className="min-w-[160px] md:min-w-0 bg-card/50 backdrop-blur-sm p-3 md:p-4 rounded-2xl border border-border flex items-center gap-3 snap-start">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Bed className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-lg md:text-xl font-black text-foreground leading-none">
                24+
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                Total Kamar
              </div>
            </div>
          </div>

          <div className="min-w-[160px] md:min-w-0 bg-card/50 backdrop-blur-sm p-3 md:p-4 rounded-2xl border border-border flex items-center gap-3 snap-start">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
            </div>
            <div className="min-w-0">
              <div className="text-lg md:text-xl font-black text-foreground leading-none">
                12.4K
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                Total User
              </div>
            </div>
          </div>

          <div className="min-w-[160px] md:min-w-0 bg-card/50 backdrop-blur-sm p-3 md:p-4 rounded-2xl border border-border flex items-center gap-3 snap-start">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <div className="text-lg md:text-xl font-black text-foreground leading-none">
                28.5K
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                Total Sewa
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Room Selection */}
      <section className="mt-16 pl-6 md:pl-12 lg:pl-20">
        <div className="flex items-center justify-between mb-6 pr-6 md:pr-12 lg:pr-20">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Kamar Mewah Kami</h2>
            <p className="text-sm text-muted-foreground mt-1">Sempurna untuk liburan impian Anda</p>
          </div>
          <div className="flex items-center gap-4">
            <ToggleGroup
              type="single"
              value={mobilePackageView}
              onValueChange={(value) => {
                if (value) setMobilePackageView(value as "carousel" | "list" | "grid2");
              }}
              variant="outline"
              size="sm"
              className="bg-card/70 backdrop-blur-sm rounded-xl p-1 border border-border flex"
            >
              <ToggleGroupItem value="carousel" aria-label="Carousel" className="rounded-lg">
                <LayoutGrid className="w-4 h-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List" className="rounded-lg">
                <List className="w-4 h-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="grid2" aria-label="2 Kolom" className="rounded-lg">
                <Grid2X2 className="w-4 h-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button variant="ghost" className="text-primary font-bold hidden md:flex" onClick={() => navigate("/search")}>
              Lihat Semua
            </Button>
          </div>
        </div>
        
        {mobilePackageView === "carousel" ? (
          <Carousel
            opts={{ align: "start", dragFree: true }}
            className="w-full"
          >
            <CarouselContent className="-ml-4 md:-ml-6">
              {rooms.map((room, index) => (
                <CarouselItem key={room.id} className="pl-4 md:pl-6 basis-[85%] sm:basis-[60%] md:basis-[45%] lg:basis-[30%]">
                  <div className="h-full">
                    <RoomCard room={room} index={index} variant="basic" />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : (
          <div
            className={cn(
              "pr-6 md:pr-12 lg:pr-20",
              mobilePackageView === "list" ? "flex flex-col gap-4" : "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-8"
            )}
          >
            {rooms.map((room, index) => (
              <RoomCard key={room.id} room={room} index={index} variant={mobilePackageView === "list" ? "list" : "basic"} />
            ))}
          </div>
        )}
      </section>

      {/* Trust / Testimonial Section */}
      <section className="px-6 md:px-12 lg:px-20 mt-20">
        <div className="bg-card/50 backdrop-blur-xl rounded-[2.5rem] p-8 sm:p-10 border border-border flex flex-col md:flex-row items-center gap-8 justify-between relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-xl w-full">
            <Quote className="w-10 h-10 text-primary/40 mb-4" />
            <Carousel
              plugins={[Autoplay({ delay: 4000, stopOnInteraction: true })]}
              opts={{ loop: true }}
              className="w-full"
            >
              <CarouselContent>
                {[
                  {
                    text: "Pengalaman menginap yang tak terlupakan! Pelayanan sangat ramah, pemandangan luar biasa, dan kamarnya sangat nyaman.",
                    name: "Puspita Dewi",
                    role: "Tamu VIP"
                  },
                  {
                    text: "Fasilitas lengkap dan sangat cocok untuk liburan keluarga. Anak-anak sangat menyukai kolam renangnya yang bersih!",
                    name: "Budi Santoso",
                    role: "Keluarga"
                  },
                  {
                    text: "Suasana sangat romantis dan menenangkan. Dekorasi kamar saat kedatangan sangat memukau. Truly a paradise.",
                    name: "Sarah & John",
                    role: "Honeymoon"
                  }
                ].map((review, idx) => (
                  <CarouselItem key={idx}>
                    <h3 className="text-xl sm:text-2xl font-bold text-foreground leading-snug">
                       "{review.text}"
                    </h3>
                    <div className="text-sm text-muted-foreground mt-4 font-medium flex items-center gap-2">
                      <span className="w-10 h-[2px] bg-primary rounded-full"></span>
                      {review.name}, {review.role}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
          <div className="flex items-center gap-4 bg-background p-6 rounded-3xl shadow-sm border border-border shrink-0 z-10 w-full md:w-auto">
             <div className="text-center">
                 <div className="text-4xl font-black text-foreground">4.9/5</div>
                 <div className="flex gap-1 justify-center mt-1 text-accent">
                    <Star className="w-4 h-4 fill-current"/>
                    <Star className="w-4 h-4 fill-current"/>
                    <Star className="w-4 h-4 fill-current"/>
                    <Star className="w-4 h-4 fill-current"/>
                    <Star className="w-4 h-4 fill-current"/>
                 </div>
                 <div className="text-xs font-bold text-muted-foreground mt-2 uppercase tracking-wide">Dari 150+ Ulasan</div>
             </div>
          </div>
        </div>
      </section>

      {/* Amenities Section */}
      <section className="px-6 md:px-12 lg:px-20 mt-20 pb-12">
        <div className="bg-muted/50 rounded-[3rem] p-8 md:p-12 border border-border">
          <h2 className="text-2xl font-bold text-foreground mb-8">Fasilitas Villa</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
            {[
              { icon: Waves, label: "Infinity Pool" },
              { icon: Wifi, label: "Free High-Speed WiFi" },
              { icon: TreePine, label: "Tropical Garden" },
              { icon: ParkingCircle, label: "Private Parking" },
              { icon: ChefHat, label: "Kitchenette" },
              { icon: ShieldCheck, label: "24/7 Security" }
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-3 text-sm text-muted-foreground text-center">
                <div className="w-12 h-12 rounded-2xl bg-background flex items-center justify-center shadow-sm">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
