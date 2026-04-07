import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard,
  Users, 
  CalendarCheck, 
  Wallet, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ArrowLeft,
  Bed,
  Info,
  Calendar as CalendarIcon,
  Settings,
  LogOut,
  Mail,
  Phone,
  Plus,
  Trash2,
  Edit,
  Save,
  Image as ImageIcon,
  List,
  FileSpreadsheet,
  Download,
  TrendingUp,
  BarChart3,
  Filter,
  Receipt,
  BadgePercent,
  CircleDollarSign,
  DoorOpen,
  DoorClosed,
  ShieldCheck,
  FileText,
  ExternalLink,
  Eye,
  CreditCard
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Room, VillaInfo } from "@/data/villas";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Line, LineChart, XAxis, CartesianGrid } from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

interface AdminStats {
  totalUsers: number;
  totalBookings: number;
  totalRevenue: number;
}

interface AdminBooking {
  id: string;
  room_id: string;
  villa_name: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  total_price: number;
  guests: number;
  children: number;
  payment_method: string;
  legal_docs?: string; // JSON string from backend
  payment_receipt?: string;
  status: string;
  created_at: string;
  guest_phone?: string;
}

interface VillaPolicies {
  check_in_start: string;
  check_in_end: string;
  check_out_time: string;
  no_smoking: boolean;
  rules: string[];
}

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

const AdminDashboard = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [villaData, setVillaData] = useState<VillaInfo | null>(null);
  const [policies, setPolicies] = useState<VillaPolicies | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [policyNoSmoking, setPolicyNoSmoking] = useState(true);
  const [reportPeriod, setReportPeriod] = useState("all");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [viewDocsBooking, setViewDocsBooking] = useState<AdminBooking | null>(null);
  const [selectedDetailBooking, setSelectedDetailBooking] = useState<AdminBooking | null>(null);
  
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
  const token = localStorage.getItem("auth_token");

  const fetchData = async () => {
    try {
      const [statsRes, bookingsRes, roomsRes, villaRes, policiesRes] = await Promise.all([
        fetch(`${API_URL}/admin/stats`, { headers: { "Authorization": `Bearer ${token}` } }),
        fetch(`${API_URL}/admin/bookings`, { headers: { "Authorization": `Bearer ${token}` } }),
        fetch(`${API_URL}/rooms`),
        fetch(`${API_URL}/villa-info`),
        fetch(`${API_URL}/villa-policies`)
      ]);

      if (!statsRes.ok || !bookingsRes.ok) throw new Error("Gagal mengambil data admin");

      const statsData = await statsRes.json();
      const bookingsData = await bookingsRes.json();
      const roomsData = await roomsRes.json();
      const villaInfoData = await villaRes.json();
      const policiesData = policiesRes.ok ? await policiesRes.json() : null;

      setStats(statsData);
      setBookings(bookingsData);
      setRooms(
        (roomsData as unknown[]).map((raw) => {
          const r = raw as Record<string, unknown>;
          const amenitiesRaw = r.amenities;
          const imagesRaw = r.images;

          return {
            ...(r as unknown as Room),
            amenities: (typeof amenitiesRaw === "string" ? JSON.parse(amenitiesRaw) : amenitiesRaw) as string[],
            images: (typeof imagesRaw === "string" ? JSON.parse(imagesRaw) : imagesRaw) as string[],
          };
        }),
      );
      setVillaData(villaInfoData);
      setPolicies(policiesData);
      setPolicyNoSmoking(Boolean(policiesData?.no_smoking ?? true));
    } catch (error) {
      toast.error("Gagal memuat data dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!user || user.role !== 'admin') {
      navigate("/");
      return;
    }

    fetchData();
  }, [user, navigate]);

  const updateStatus = async (bookingId: string, newStatus: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error();
      
      setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
      toast.success(`Status berhasil diubah ke ${newStatus}`);
    } catch (error) {
      toast.error("Gagal mengubah status");
    }
  };

  const handleUpdateVilla = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      app_name: formData.get("app_name"),
      app_logo_url: formData.get("app_logo_url"),
      name: formData.get("name"),
      location: formData.get("location"),
      description: formData.get("description"),
      image: formData.get("image"),
      rating: parseFloat(formData.get("rating") as string),
      reviews: parseInt(formData.get("reviews") as string),
      theme_color: formData.get("theme_color"),
    };

    try {
      const res = await fetch(`${API_URL}/admin/villa-info`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error();
      toast.success("Informasi Villa diperbarui");
      fetchData();
      const nextAppName = String(data.app_name || data.name || "");
      if (nextAppName) {
        document.title = nextAppName;
      }
      const nextLogoUrl = String(data.app_logo_url || "");
      if (nextLogoUrl) {
        let iconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
        if (!iconLink) {
          iconLink = document.createElement("link");
          iconLink.rel = "icon";
          document.head.appendChild(iconLink);
        }
        iconLink.href = nextLogoUrl;
      }
    } catch (error) {
      toast.error("Gagal memperbarui informasi villa");
    }
  };

  const handleUpdatePolicies = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rulesText = String(formData.get("rules") || "");
    const rules = rulesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const data = {
      check_in_start: String(formData.get("check_in_start") || "14:00"),
      check_in_end: String(formData.get("check_in_end") || "22:00"),
      check_out_time: String(formData.get("check_out_time") || "12:00"),
      no_smoking: policyNoSmoking,
      rules,
    };

    try {
      const res = await fetch(`${API_URL}/admin/villa-policies`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success("Kebijakan Villa diperbarui");
      fetchData();
    } catch (error) {
      toast.error("Gagal memperbarui kebijakan villa");
    }
  };

  const handleSaveRoom = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const formParams = new FormData();

    formParams.append("name", formData.get("name") as string);
    formParams.append("type", formData.get("type") as string);
    formParams.append("price", formData.get("price") as string);
    formParams.append("capacity", formData.get("capacity") as string);

    // Filter file uploads
    const fileInputs = formData.getAll("images") as File[];
    fileInputs.forEach(file => {
      if (file.size > 0) formParams.append("images", file);
    });

    const amenitiesArr = (formData.get("amenities") as string).split(",").map(s => s.trim());
    formParams.append("amenities", JSON.stringify(amenitiesArr));
    formParams.append("description", formData.get("description") as string);
    
    if (editingRoom) {
      formParams.append("existingImages", JSON.stringify(editingRoom.images));
    }

    try {
      const method = editingRoom ? "PUT" : "POST";
      const url = editingRoom ? `${API_URL}/admin/rooms/${editingRoom.id}` : `${API_URL}/admin/rooms`;
      
      const res = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formParams
      });

      if (!res.ok) throw new Error();
      toast.success(editingRoom ? "Kamar diperbarui" : "Kamar ditambahkan");
      setIsRoomDialogOpen(false);
      setEditingRoom(null);
      fetchData();
    } catch (error) {
      toast.error("Gagal menyimpan kamar");
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm("Hapus kamar ini?")) return;
    try {
      const res = await fetch(`${API_URL}/admin/rooms/${roomId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      toast.success("Kamar dihapus");
      fetchData();
    } catch (error) {
      toast.error("Gagal menghapus kamar");
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);

  const todayText = format(new Date(), "d MMM, yyyy", { locale: idLocale });
  const adminName = user?.user_metadata?.full_name || "Admin";
  const adminEmail = user?.email || "admin@local";

  const chartConfig = {
    bookings: {
      label: "Booking",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  const recentBookings = bookings.slice(0, 6);
  const activityBookings = bookings.slice(0, 4);

  // ── Room status computation ──
  type RoomStatus = "occupied" | "pending" | "confirmed" | "available";
  interface RoomWithStatus {
    room: Room;
    status: RoomStatus;
    guestName?: string;
    checkIn?: string;
    checkOut?: string;
  }

  const roomStatuses: RoomWithStatus[] = rooms.map((room) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find active bookings for this room (not cancelled/completed)
    const activeBookings = bookings.filter(
      (b) =>
        (b.room_id === room.id || b.villa_name === room.name) &&
        b.status !== "cancelled" && b.status !== "completed"
    );

    // Check if currently occupied (today is between check_in and check_out, status confirmed)
    const occupiedBooking = activeBookings.find((b) => {
      const ci = new Date(b.check_in);
      const co = new Date(b.check_out);
      ci.setHours(0, 0, 0, 0);
      co.setHours(0, 0, 0, 0);
      return b.status === "confirmed" && today >= ci && today < co;
    });
    if (occupiedBooking) {
      return {
        room,
        status: "occupied" as RoomStatus,
        guestName: occupiedBooking.guest_name,
        checkIn: occupiedBooking.check_in,
        checkOut: occupiedBooking.check_out,
      };
    }

    // Check for upcoming pending bookings
    const pendingBooking = activeBookings.find((b) => b.status === "pending");
    if (pendingBooking) {
      return {
        room,
        status: "pending" as RoomStatus,
        guestName: pendingBooking.guest_name,
        checkIn: pendingBooking.check_in,
        checkOut: pendingBooking.check_out,
      };
    }

    // Check for upcoming confirmed bookings (future)
    const confirmedBooking = activeBookings.find((b) => {
      const ci = new Date(b.check_in);
      ci.setHours(0, 0, 0, 0);
      return b.status === "confirmed" && ci > today;
    });
    if (confirmedBooking) {
      return {
        room,
        status: "confirmed" as RoomStatus,
        guestName: confirmedBooking.guest_name,
        checkIn: confirmedBooking.check_in,
        checkOut: confirmedBooking.check_out,
      };
    }

    return { room, status: "available" as RoomStatus };
  });

  const roomStatusConfig: Record<RoomStatus, { bg: string; border: string; badge: string; badgeBg: string; label: string; icon: string }> = {
    occupied: { bg: "bg-blue-50", border: "border-blue-200", badge: "text-blue-700", badgeBg: "bg-blue-100", label: "Terisi", icon: "🔵" },
    pending: { bg: "bg-amber-50", border: "border-amber-200", badge: "text-amber-700", badgeBg: "bg-amber-100", label: "Menunggu Konfirmasi", icon: "🟡" },
    confirmed: { bg: "bg-green-50", border: "border-green-200", badge: "text-green-700", badgeBg: "bg-green-100", label: "Booking Terkonfirmasi", icon: "🟢" },
    available: { bg: "bg-slate-50", border: "border-slate-200", badge: "text-slate-500", badgeBg: "bg-slate-100", label: "Kosong", icon: "⚪" },
  };

  const occupiedCount = roomStatuses.filter(r => r.status === "occupied").length;
  const pendingCount = roomStatuses.filter(r => r.status === "pending").length;
  const confirmedCount = roomStatuses.filter(r => r.status === "confirmed").length;
  const availableCount = roomStatuses.filter(r => r.status === "available").length;

  const last7Days = Array.from({ length: 7 }).map((_, index) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - index));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const performanceData = last7Days.map((d) => {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const count = bookings.filter((b) => {
      const created = new Date(b.created_at);
      return created >= d && created < next;
    }).length;
    return {
      day: format(d, "dd MMM", { locale: idLocale }),
      bookings: count,
    };
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Tabs defaultValue="dashboard" className="flex min-h-screen">
        <aside className="hidden lg:flex w-72 border-r bg-white px-4 py-6 flex-col">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-primary" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-black text-slate-900">logip</div>
                <div className="text-[11px] text-slate-500 font-medium">Admin Panel</div>
              </div>
            </div>
            <button onClick={() => navigate("/")} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4 text-slate-700" />
            </button>
          </div>

          <div className="mt-8">
            <TabsList className="flex flex-col items-stretch justify-start h-auto bg-transparent p-0 text-slate-600">
              <TabsTrigger value="dashboard" className="justify-start rounded-xl px-3 py-2.5 gap-2 data-[state=active]:bg-slate-50 data-[state=active]:shadow-none">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="booking-list" className="justify-start rounded-xl px-3 py-2.5 gap-2 data-[state=active]:bg-slate-50 data-[state=active]:shadow-none">
                <List className="w-4 h-4" /> Daftar Booking
              </TabsTrigger>
              <TabsTrigger value="rooms" className="justify-start rounded-xl px-3 py-2.5 gap-2 data-[state=active]:bg-slate-50 data-[state=active]:shadow-none">
                <Bed className="w-4 h-4" /> Rooms
              </TabsTrigger>
              <TabsTrigger value="villa" className="justify-start rounded-xl px-3 py-2.5 gap-2 data-[state=active]:bg-slate-50 data-[state=active]:shadow-none">
                <Info className="w-4 h-4" /> Villa
              </TabsTrigger>
              <TabsTrigger value="policies" className="justify-start rounded-xl px-3 py-2.5 gap-2 data-[state=active]:bg-slate-50 data-[state=active]:shadow-none">
                <Settings className="w-4 h-4" /> Settings
              </TabsTrigger>
              <TabsTrigger value="laporan" className="justify-start rounded-xl px-3 py-2.5 gap-2 data-[state=active]:bg-slate-50 data-[state=active]:shadow-none">
                <FileSpreadsheet className="w-4 h-4" /> Laporan
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-auto pt-6">
            <button
              onClick={() => navigate("/")}
              className="w-full flex items-center justify-start gap-2 px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Log out</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Hello, {adminName.split(" ")[0]}</h1>
                <p className="text-slate-500 text-sm mt-1">Track progress booking di sini.</p>
              </div>
              <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-2xl px-3 py-2 shadow-sm">
                <span className="text-xs font-bold text-slate-600">{todayText}</span>
                <CalendarIcon className="w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div className="mt-6 lg:hidden">
              <TabsList className="w-full grid grid-cols-6 bg-white border h-12 rounded-2xl p-1 shadow-sm">
                <TabsTrigger value="dashboard" className="rounded-xl gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="booking-list" className="rounded-xl gap-2">
                  <List className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="rooms" className="rounded-xl gap-2">
                  <Bed className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="villa" className="rounded-xl gap-2">
                  <Info className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="policies" className="rounded-xl gap-2">
                  <Settings className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="laporan" className="rounded-xl gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="dashboard" className="mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Finished</p>
                    <h3 className="text-xl font-black text-slate-900">{stats?.totalUsers || 0}</h3>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
                    <CalendarCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tracked</p>
                    <h3 className="text-xl font-black text-slate-900">{stats?.totalBookings || 0}</h3>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Revenue</p>
                    <h3 className="text-xl font-black text-slate-900">{formatPrice(stats?.totalRevenue || 0)}</h3>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-900">Performance</h2>
                    <div className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-2 rounded-full">
                      Last 7 days
                    </div>
                  </div>
                  <div className="mt-4">
                    <ChartContainer config={chartConfig} className="h-[260px] w-full">
                      <LineChart data={performanceData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="day" tickLine={false} axisLine={false} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                        <Line
                          dataKey="bookings"
                          type="monotone"
                          stroke="var(--color-bookings)"
                          strokeWidth={3}
                          dot={false}
                        />
                      </LineChart>
                    </ChartContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-900">Current Tasks</h2>
                    <div className="text-xs font-bold text-slate-500">Top {recentBookings.length}</div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {recentBookings.map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-2xl px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{booking.villa_name}</div>
                          <div className="text-[11px] text-slate-500 truncate">{booking.guest_name}</div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${statusColors[booking.status]}`}>
                          {booking.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Room Status Overview */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <Bed className="w-5 h-5 text-primary" /> Status Kamar
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">Kondisi seluruh kamar hari ini</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Terisi ({occupiedCount})
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Pending ({pendingCount})
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400" /> Dikonfirmasi ({confirmedCount})
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Kosong ({availableCount})
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roomStatuses.map(({ room, status, guestName, checkIn, checkOut }) => {
                    const cfg = roomStatusConfig[status];
                    return (
                      <div
                        key={room.id}
                        className={`${cfg.bg} ${cfg.border} border rounded-3xl p-5 transition-all hover:shadow-md`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white border border-white/50 shrink-0 shadow-sm">
                              <img src={room.image} className="w-full h-full object-cover" alt={room.name} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-black text-slate-900 truncate">{room.name}</h3>
                              <p className="text-[11px] text-slate-500 font-medium">{room.type} · {room.capacity} tamu</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase whitespace-nowrap ${cfg.badgeBg} ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                        </div>
                        {status !== "available" && guestName && (
                          <div className="mt-3 pt-3 border-t border-black/5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-slate-500 font-medium">Tamu</p>
                                <p className="text-sm font-bold text-slate-900">{guestName}</p>
                              </div>
                              {checkIn && checkOut && (
                                <div className="text-right">
                                  <p className="text-xs text-slate-500 font-medium">Periode</p>
                                  <p className="text-[11px] font-bold text-slate-700">
                                    {format(new Date(checkIn), "dd MMM", { locale: idLocale })} - {format(new Date(checkOut), "dd MMM", { locale: idLocale })}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {status === "available" && (
                          <div className="mt-3 pt-3 border-t border-black/5 flex items-center gap-2">
                            <DoorOpen className="w-4 h-4 text-slate-400" />
                            <p className="text-xs text-slate-400 font-medium">Kamar tersedia untuk booking</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              </TabsContent>

            <TabsContent value="booking-list" className="mt-6">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Daftar Booking</h2>
                    <p className="text-sm text-slate-500 mt-1">Kelola semua data pemesanan dalam bentuk tabel rekap.</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Villa & Tamu</TableHead>
                      <TableHead>Check-in / Out</TableHead>
                      <TableHead>Total Harga</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell>
                          <div className="font-bold text-slate-900">{booking.villa_name}</div>
                          <div className="font-medium text-slate-700 mt-1">{booking.guest_name}</div>
                          <div className="text-xs text-slate-500">{booking.guest_email}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1"><Wallet className="w-3 h-3"/> {booking.payment_method}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{format(new Date(booking.check_in), "dd MMM yy", { locale: idLocale })} - {format(new Date(booking.check_out), "dd MMM yy", { locale: idLocale })}</div>
                          <div className="text-xs text-slate-500 mt-1">{booking.guests} Dewasa {booking.children > 0 ? `, ${booking.children} Anak` : ""}</div>
                        </TableCell>
                        <TableCell className="font-black text-slate-900">
                          {formatPrice(booking.total_price)}
                        </TableCell>
                        <TableCell>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${statusColors[booking.status]}`}>
                            {booking.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-primary/20 text-primary hover:bg-primary/5 h-8 gap-1 rounded-xl"
                              onClick={() => setSelectedDetailBooking(booking)}
                            >
                              <Info className="w-3 h-3" /> Detail
                            </Button>
                            {booking.legal_docs && JSON.parse(booking.legal_docs).length > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-amber-200 text-amber-600 hover:bg-amber-50 h-8 gap-1 rounded-xl"
                                onClick={() => setViewDocsBooking(booking)}
                              >
                                <Eye className="w-3 h-3" /> Dokumen
                              </Button>
                            )}
                            {booking.status !== "cancelled" && booking.status !== "completed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50 h-8 gap-1 rounded-xl"
                                onClick={() => updateStatus(booking.id, "cancelled")}
                              >
                                <XCircle className="w-3 h-3" /> Batal
                              </Button>
                            )}
                            {booking.status === "confirmed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-blue-200 text-blue-600 hover:bg-blue-50 h-8 gap-1 rounded-xl"
                                onClick={() => updateStatus(booking.id, "completed")}
                              >
                                <CheckCircle2 className="w-3 h-3" /> Selesai
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {bookings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-slate-500">Belum ada booking.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="rooms" className="mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Rooms</h2>
                  <p className="text-sm text-slate-500 mt-1">Kelola data kamar.</p>
                </div>
                <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingRoom(null)} size="sm" className="rounded-2xl gap-2 h-10">
                      <Plus className="w-4 h-4" /> Tambah
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingRoom ? "Edit Kamar" : "Tambah Kamar Baru"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveRoom} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Nama Kamar</Label>
                        <Input name="name" defaultValue={editingRoom?.name} required placeholder="Contoh: Deluxe King Room" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Tipe Kamar</Label>
                        <Input name="type" defaultValue={editingRoom?.type} required placeholder="Contoh: Master Suite" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Harga / Malam</Label>
                          <Input name="price" type="number" defaultValue={editingRoom?.price} required />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Kapasitas (Tamu)</Label>
                          <Input name="capacity" type="number" defaultValue={editingRoom?.capacity} required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Gambar Kamar (Upload Banyak File)</Label>
                        <Input name="images" type="file" multiple accept="image/*" />
                        {editingRoom && <div className="text-xs text-muted-foreground mt-1">Biarkan kosong jika tidak ingin menambah gambar baru.</div>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Fasilitas (Pisahkan dengan koma)</Label>
                        <Input name="amenities" defaultValue={editingRoom?.amenities.join(", ")} placeholder="WiFi, AC, TV, dll" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Deskripsi</Label>
                        <Textarea name="description" defaultValue={editingRoom?.description} rows={3} required />
                      </div>
                      <DialogFooter>
                        <Button type="submit" className="w-full h-12 rounded-2xl">Simpan</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {rooms.map((room) => (
                  <div key={room.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden shrink-0">
                        <img src={room.image} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-slate-900 truncate">{room.name}</h3>
                        <p className="text-xs text-slate-500 mt-1">{room.type}</p>
                        <p className="text-sm font-black text-primary mt-2">{formatPrice(room.price)}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-2xl text-slate-500"
                          onClick={() => {
                            setEditingRoom(room);
                            setIsRoomDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-2xl text-red-500 hover:text-red-600"
                          onClick={() => handleDeleteRoom(room.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="villa" className="mt-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h2 className="text-lg font-black text-slate-900 mb-6">Villa Info</h2>
                <form onSubmit={handleUpdateVilla} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Nama Aplikasi</Label>
                    <Input name="app_name" defaultValue={villaData?.app_name} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">URL Logo Aplikasi</Label>
                    <Input name="app_logo_url" defaultValue={villaData?.app_logo_url} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Nama Villa</Label>
                    <Input name="name" defaultValue={villaData?.name} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Lokasi</Label>
                    <Input name="location" defaultValue={villaData?.location} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Deskripsi</Label>
                    <Textarea name="description" defaultValue={villaData?.description} rows={4} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">URL Gambar Header</Label>
                    <div className="flex gap-2">
                      <Input name="image" defaultValue={villaData?.image} />
                      <Button type="button" variant="outline" size="icon" className="shrink-0 rounded-2xl">
                        <ImageIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Rating</Label>
                      <Input name="rating" type="number" step="0.1" defaultValue={villaData?.rating} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Jumlah Review</Label>
                      <Input name="reviews" type="number" defaultValue={villaData?.reviews} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-sm font-medium">Tema Warna Aplikasi</Label>
                      <div className="flex gap-3 mt-1">
                        {[
                          { name: "Orange", value: "16 65% 50%", cssClass: "bg-[#e86634]" },
                          { name: "Blue", value: "220 70% 50%", cssClass: "bg-blue-500" },
                          { name: "Green", value: "150 60% 45%", cssClass: "bg-green-500" },
                          { name: "Purple", value: "270 65% 55%", cssClass: "bg-purple-500" },
                          { name: "Red", value: "0 70% 50%", cssClass: "bg-red-500" },
                          { name: "Rose", value: "346 77% 49%", cssClass: "bg-rose-500" },
                        ].map(theme => (
                          <label key={theme.name} className="flex flex-col items-center gap-1 cursor-pointer">
                            <input type="radio" name="theme_color" value={theme.value} className="sr-only peer" defaultChecked={villaData?.theme_color === theme.value || (!villaData?.theme_color && theme.name === "Orange")} />
                            <div className={`w-10 h-10 rounded-full ${theme.cssClass} peer-checked:ring-4 ring-slate-900/40 ring-offset-2 transition-all`}></div>
                            <span className="text-[10px] font-bold text-slate-500 peer-checked:text-slate-900">{theme.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-12 rounded-2xl gap-2 mt-2 shadow-lg shadow-primary/20">
                    <Save className="w-5 h-5" /> Simpan
                  </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="policies" className="mt-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h2 className="text-lg font-black text-slate-900 mb-6">Kebijakan Villa</h2>
                <form onSubmit={handleUpdatePolicies} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Check-in Start</Label>
                      <Input
                        name="check_in_start"
                        type="time"
                        defaultValue={(policies?.check_in_start || "14:00:00").slice(0, 5)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Check-in End</Label>
                      <Input
                        name="check_in_end"
                        type="time"
                        defaultValue={(policies?.check_in_end || "22:00:00").slice(0, 5)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Check-out</Label>
                      <Input
                        name="check_out_time"
                        type="time"
                        defaultValue={(policies?.check_out_time || "12:00:00").slice(0, 5)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="no_smoking"
                      checked={policyNoSmoking}
                      onCheckedChange={(checked) => setPolicyNoSmoking(checked === true)}
                    />
                    <Label htmlFor="no_smoking" className="text-sm font-medium text-slate-700">
                      Dilarang merokok
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Rules (1 baris 1 aturan)</Label>
                    <Textarea
                      name="rules"
                      defaultValue={(policies?.rules || []).join("\n")}
                      rows={5}
                      className="rounded-2xl"
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 rounded-2xl gap-2 mt-2 shadow-lg shadow-primary/20">
                    <Save className="w-5 h-5" /> Simpan
                  </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="laporan" className="mt-6">
              <LaporanTab
                bookings={bookings}
                reportPeriod={reportPeriod}
                setReportPeriod={setReportPeriod}
                reportStartDate={reportStartDate}
                setReportStartDate={setReportStartDate}
                reportEndDate={reportEndDate}
                setReportEndDate={setReportEndDate}
                formatPrice={formatPrice}
                setViewDocsBooking={setViewDocsBooking}
              />
            </TabsContent>
          </div>
        </main>

        <aside className="hidden xl:flex w-96 border-l bg-slate-50 px-6 py-8 flex-col">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-black">
                {adminName
                  .split(" ")
                  .slice(0, 2)
                  .map((s) => s.charAt(0).toUpperCase())
                  .join("")}
              </div>
              <div className="flex gap-2">
                <button className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-slate-500" />
                </button>
                <button className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm font-black text-slate-900">{adminName}</div>
              <div className="text-xs text-slate-500">{adminEmail}</div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex-1">
            <div className="text-sm font-black text-slate-900">Activity</div>
            <div className="mt-4 space-y-4">
              {activityBookings.map((booking) => (
                <div key={booking.id} className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 font-black">
                    {booking.guest_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 truncate">{booking.guest_name}</div>
                    <div className="text-[11px] text-slate-500 truncate">Booking {booking.villa_name}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${statusColors[booking.status]}`}>
                        {booking.status}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {format(new Date(booking.created_at), "HH:mm", { locale: idLocale })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {activityBookings.length === 0 && (
                <div className="text-sm text-slate-500">Belum ada aktivitas.</div>
              )}
            </div>
          </div>
        </aside>
      </Tabs>

      {/* Dialog View Documents */}
      <Dialog open={!!viewDocsBooking} onOpenChange={(open) => !open && setViewDocsBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              Verifikasi Dokumen Syariah
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tamu</p>
              <p className="text-sm font-black text-slate-900">{viewDocsBooking?.guest_name}</p>
              <p className="text-xs text-slate-500 mt-1">{viewDocsBooking?.villa_name} · {viewDocsBooking?.guests} Tamu</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Daftar File ({viewDocsBooking?.legal_docs ? JSON.parse(viewDocsBooking.legal_docs).length : 0})</p>
              {viewDocsBooking?.legal_docs && JSON.parse(viewDocsBooking.legal_docs).map((path: string, idx: number) => (
                <a 
                  key={idx}
                  href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'}${path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Dokumen {idx + 1}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                </a>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDocsBooking(null)} className="rounded-xl">Tutup</Button>
            {viewDocsBooking?.status === 'pending' && (
              <Button 
                className="bg-green-600 hover:bg-green-700 rounded-xl"
                onClick={() => {
                  updateStatus(viewDocsBooking.id, 'confirmed');
                  setViewDocsBooking(null);
                }}
              >
                Konfirmasi Booking
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detail Booking */}
      <Dialog open={!!selectedDetailBooking} onOpenChange={(open) => !open && setSelectedDetailBooking(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" /> Rincian Lengkap Pesanan
            </DialogTitle>
          </DialogHeader>
          
          {selectedDetailBooking && (
            <div className="space-y-6 py-4">
              {/* Guest & Status Header */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 bg-slate-50 p-5 rounded-3xl border border-slate-100">
                <div>
                  <h3 className="text-xl font-black text-slate-900">{selectedDetailBooking.guest_name}</h3>
                  <div className="flex flex-col gap-1 mt-2">
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> {selectedDetailBooking.guest_email}
                    </p>
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                      <Phone className="w-4 h-4" /> {selectedDetailBooking.guest_phone || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                   <span className={`text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider ${statusColors[selectedDetailBooking.status]}`}>
                    {selectedDetailBooking.status}
                  </span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Dipesan pada: {format(new Date(selectedDetailBooking.created_at), "dd MMM yyyy, HH:mm", { locale: idLocale })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Booking Info */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Informasi Villa</h4>
                  <div className="bg-white border border-slate-100 p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Villa</span>
                      <span className="font-bold text-slate-900">{selectedDetailBooking.villa_name}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Durasi</span>
                      <span className="font-bold text-slate-900">
                        {format(new Date(selectedDetailBooking.check_in), "dd MMM", { locale: idLocale })} - {format(new Date(selectedDetailBooking.check_out), "dd MMM yyyy", { locale: idLocale })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Tamu</span>
                      <span className="font-bold text-slate-900">{selectedDetailBooking.guests} Dewasa, {selectedDetailBooking.children} Anak</span>
                    </div>
                  </div>

                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] pt-2">Pembayaran</h4>
                  <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Metode</span>
                      <span className="font-bold text-slate-900 uppercase">{selectedDetailBooking.payment_method}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-sm">Total Tagihan</span>
                      <span className="font-black text-primary text-lg">{formatPrice(selectedDetailBooking.total_price)}</span>
                    </div>
                  </div>
                </div>

                {/* Evidence / Attachments */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Kepatuhan Syariah</h4>
                  <div className="bg-white border border-slate-100 p-4 rounded-2xl">
                    {selectedDetailBooking.legal_docs ? (
                      <div className="space-y-2">
                        <p className="text-[10px] text-slate-500 font-bold mb-2">DOKUMEN IDENTITAS ({JSON.parse(selectedDetailBooking.legal_docs).length})</p>
                        <div className="flex flex-wrap gap-2">
                          {JSON.parse(selectedDetailBooking.legal_docs).map((p: string, i: number) => (
                            <a key={i} href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'}${p}`} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-primary/10 hover:text-primary transition-colors border border-slate-200">
                              <FileText className="w-5 h-5" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Belum ada dokumen diunggah.</p>
                    )}
                  </div>

                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] pt-2">Bukti Bayar</h4>
                  <div className="bg-white border border-slate-100 p-4 rounded-2xl min-h-[140px] flex flex-col justify-center items-center gap-3">
                    {selectedDetailBooking.payment_receipt ? (
                      <>
                        <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
                          <img 
                            src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'}${selectedDetailBooking.payment_receipt}`} 
                            alt="Bukti Transfer" 
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <Button asChild size="sm" variant="outline" className="w-full rounded-xl gap-2 h-10 border-primary/20 text-primary">
                          <a href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'}${selectedDetailBooking.payment_receipt}`} target="_blank" rel="noreferrer">
                            <Eye className="w-4 h-4" /> Lihat Ukuran Penuh
                          </a>
                        </Button>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-8 h-8 text-slate-300" />
                        <p className="text-sm text-slate-400 text-center px-4 italic">Tamu belum mengunggah bukti transfer.</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSelectedDetailBooking(null)} className="rounded-xl flex-1 h-12">
              Tutup
            </Button>
            {selectedDetailBooking?.status === 'pending' && (
              <>
                <Button 
                  variant="destructive"
                  className="rounded-xl flex-1 h-12"
                  onClick={() => {
                    updateStatus(selectedDetailBooking.id, 'cancelled');
                    setSelectedDetailBooking(null);
                  }}
                >
                  Batalkan
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700 rounded-xl flex-1 h-12"
                  onClick={() => {
                    updateStatus(selectedDetailBooking.id, 'confirmed');
                    setSelectedDetailBooking(null);
                  }}
                >
                  Konfirmasi
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


/* ─── Laporan (Accounting Report) Tab Component ─── */

interface LaporanTabProps {
  bookings: AdminBooking[];
  reportPeriod: string;
  setReportPeriod: (v: string) => void;
  reportStartDate: string;
  setReportStartDate: (v: string) => void;
  reportEndDate: string;
  setReportEndDate: (v: string) => void;
  formatPrice: (n: number) => string;
  setViewDocsBooking: (b: AdminBooking) => void;
}

const LaporanTab = ({
  bookings,
  reportPeriod,
  setReportPeriod,
  reportStartDate,
  setReportStartDate,
  reportEndDate,
  setReportEndDate,
  formatPrice,
  setViewDocsBooking,
}: LaporanTabProps) => {
  const getDateRange = (): { start: Date; end: Date } | null => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (reportPeriod) {
      case "today": {
        const end = new Date(today);
        end.setDate(end.getDate() + 1);
        return { start: today, end };
      }
      case "week": {
        const start = new Date(today);
        start.setDate(start.getDate() - 7);
        return { start, end: new Date(today.getTime() + 86400000) };
      }
      case "month": {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start, end: new Date(today.getTime() + 86400000) };
      }
      case "year": {
        const start = new Date(today.getFullYear(), 0, 1);
        return { start, end: new Date(today.getTime() + 86400000) };
      }
      case "custom": {
        if (reportStartDate && reportEndDate) {
          const end = new Date(reportEndDate);
          end.setDate(end.getDate() + 1);
          return { start: new Date(reportStartDate), end };
        }
        return null;
      }
      default:
        return null;
    }
  };

  const filteredBookings = useMemo(() => {
    const range = getDateRange();
    if (!range) return bookings;
    return bookings.filter((b) => {
      const checkOut = new Date(b.check_out);
      return checkOut >= range.start && checkOut < range.end;
    });
  }, [bookings, reportPeriod, reportStartDate, reportEndDate]);

  const TAX_RATE = 0.11; // PPN 11%

  const completedBookings = filteredBookings.filter((b) => b.status === "completed" || b.status === "confirmed");
  const totalRevenueGross = completedBookings.reduce((sum, b) => sum + b.total_price, 0);
  const totalPPN = Math.round(totalRevenueGross * TAX_RATE);
  const totalRevenueNet = totalRevenueGross - totalPPN;
  const avgTransaction = completedBookings.length > 0 ? totalRevenueGross / completedBookings.length : 0;
  const cancelledCount = filteredBookings.filter((b) => b.status === "cancelled").length;

  const exportCSV = () => {
    const headers = ["No", "Nama Tamu", "Email", "Villa", "Check-in", "Check-out", "Tamu", "Anak", "Total Harga", "Metode Bayar", "Status", "Tanggal Booking"];
    const rows = filteredBookings.map((b, i) => [
      i + 1,
      b.guest_name,
      b.guest_email,
      b.villa_name,
      format(new Date(b.check_in), "dd/MM/yyyy"),
      format(new Date(b.check_out), "dd/MM/yyyy"),
      b.guests,
      b.children,
      b.total_price,
      b.payment_method,
      b.status,
      format(new Date(b.created_at), "dd/MM/yyyy HH:mm"),
    ]);

    const summaryRows = [
      [],
      ["", "", "", "", "", "", "", "PENDAPATAN KOTOR", totalRevenueGross, "", "", ""],
      ["", "", "", "", "", "", "", "PPN 11%", totalPPN, "", "", ""],
      ["", "", "", "", "", "", "", "PENDAPATAN BERSIH", totalRevenueNet, "", "", ""],
    ];

    const csvContent = [headers, ...rows, ...summaryRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const periodLabel = reportPeriod === "custom" ? `${reportStartDate}_${reportEndDate}` : reportPeriod;
    link.href = url;
    link.download = `laporan_booking_${periodLabel}_${format(new Date(), "yyyyMMdd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const periodPresets = [
    { label: "Semua", value: "all" },
    { label: "Hari Ini", value: "today" },
    { label: "7 Hari", value: "week" },
    { label: "Bulan Ini", value: "month" },
    { label: "Tahun Ini", value: "year" },
    { label: "Custom", value: "custom" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Laporan Keuangan
          </h2>
          <p className="text-sm text-slate-500 mt-1">Rekapitulasi pendapatan berdasarkan data booking.</p>
        </div>
        <Button onClick={exportCSV} className="rounded-2xl gap-2 h-10 shadow-lg shadow-primary/20">
          <Download className="w-4 h-4" />
          Ekspor CSV
        </Button>
      </div>

      {/* Filter */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3">
          <Filter className="w-4 h-4" />
          Filter Periode
        </div>
        <div className="flex flex-wrap gap-2">
          {periodPresets.map((p) => (
            <button
              key={p.value}
              onClick={() => setReportPeriod(p.value)}
              className={`px-4 py-2 rounded-2xl text-sm font-bold transition-all ${
                reportPeriod === p.value
                  ? "bg-primary text-white shadow-md shadow-primary/30"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {reportPeriod === "custom" && (
          <div className="flex flex-col sm:flex-row gap-3 mt-4 pt-4 border-t border-slate-100">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500">Dari Tanggal</Label>
              <Input
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500">Sampai Tanggal</Label>
              <Input
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-green-50 rounded-2xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Pendapatan Kotor</p>
              <h3 className="text-lg font-black text-slate-900">{formatPrice(totalRevenueGross)}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-orange-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-orange-50 rounded-2xl flex items-center justify-center">
              <BadgePercent className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-[11px] text-orange-600 font-bold uppercase tracking-wider">PPN 11%</p>
              <h3 className="text-lg font-black text-orange-600">{formatPrice(totalPPN)}</h3>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-5 rounded-3xl shadow-sm border border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-primary/15 rounded-2xl flex items-center justify-center">
              <CircleDollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[11px] text-primary font-bold uppercase tracking-wider">Pendapatan Bersih</p>
              <h3 className="text-lg font-black text-primary">{formatPrice(totalRevenueNet)}</h3>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Booking Aktif</p>
              <h3 className="text-lg font-black text-slate-900">{completedBookings.length}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-purple-50 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Rata-rata Transaksi</p>
              <h3 className="text-lg font-black text-slate-900">{formatPrice(avgTransaction)}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-red-50 rounded-2xl flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Dibatalkan</p>
              <h3 className="text-lg font-black text-slate-900">{cancelledCount}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="text-base font-black text-slate-900">Detail Transaksi</h3>
            <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
              {filteredBookings.length} data
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="font-bold text-slate-600">No</TableHead>
                <TableHead className="font-bold text-slate-600">Tamu</TableHead>
                <TableHead className="font-bold text-slate-600">Villa</TableHead>
                <TableHead className="font-bold text-slate-600">Check-out</TableHead>
                <TableHead className="font-bold text-slate-600">Metode Bayar</TableHead>
                <TableHead className="font-bold text-slate-600">Status</TableHead>
                <TableHead className="font-bold text-slate-600">Nominal</TableHead>
                <TableHead className="font-bold text-slate-600 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBookings.map((booking, idx) => (
                <TableRow key={booking.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium text-slate-500">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="font-bold text-slate-900">{booking.guest_name}</div>
                    <div className="text-xs text-slate-500">{booking.guest_email}</div>
                  </TableCell>
                  <TableCell className="font-medium text-slate-700">{booking.villa_name}</TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(booking.check_out), "dd MMM yyyy", { locale: idLocale })}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-bold uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                      {booking.payment_method}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${statusColors[booking.status]}`}>
                      {booking.status}
                    </span>
                  </TableCell>
                  <TableCell className="font-black text-slate-900">
                    {formatPrice(booking.total_price)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-primary/20 text-primary hover:bg-primary/5 h-8 gap-1 rounded-xl"
                        onClick={() => setSelectedDetailBooking(booking)}
                      >
                        <Info className="w-3 h-3" /> Detail
                      </Button>
                      {booking.legal_docs && JSON.parse(booking.legal_docs).length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-200 text-amber-600 hover:bg-amber-50 h-8 gap-1 rounded-xl"
                          onClick={() => setViewDocsBooking(booking)}
                        >
                          <Eye className="w-3 h-3" /> Dokumen
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredBookings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                    <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    Tidak ada data untuk periode ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {filteredBookings.length > 0 && (
          <div className="p-6 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-slate-500">
                Menampilkan <strong className="text-slate-900">{filteredBookings.length}</strong> transaksi
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-medium text-slate-600">Pendapatan Kotor</span>
                <span className="text-sm font-black text-slate-900">{formatPrice(totalRevenueGross)}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-medium text-orange-600 flex items-center gap-1.5">
                  <BadgePercent className="w-3.5 h-3.5" /> PPN 11%
                </span>
                <span className="text-sm font-black text-orange-600">- {formatPrice(totalPPN)}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-4 bg-primary/5 rounded-b-2xl">
                <span className="text-sm font-bold text-primary flex items-center gap-1.5">
                  <CircleDollarSign className="w-4 h-4" /> Pendapatan Bersih
                </span>
                <span className="text-xl font-black text-primary">{formatPrice(totalRevenueNet)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
