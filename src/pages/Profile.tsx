import { User, Settings, HelpCircle, LogOut, ChevronRight, Bell, Shield, LayoutDashboard, X, Save, Eye, EyeOff, MessageCircle, Phone, Mail, Globe, Moon, Sun, ChevronDown, CalendarClock, CreditCard, UploadCloud, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ProfileData {
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  email: string;
}

const Profile = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  // Edit Profile state
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Security state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Settings state
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState("id");

  // Notifications state
  const [notifBooking, setNotifBooking] = useState(true);
  const [notifPromo, setNotifPromo] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  
  // My Bookings state
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
  const token = localStorage.getItem("auth_token");

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile(data);
    } catch {
      // fallback
      setProfile({
        full_name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Pengguna",
        phone: null,
        avatar_url: null,
        email: user?.email || "",
      });
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchProfile();
  }, [user, navigate, authLoading]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const openEditProfile = () => {
    setEditName(profile?.full_name || "");
    setEditPhone(profile?.phone || "");
    setActiveDialog("edit-profile");
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      toast.error("Nama tidak boleh kosong");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ full_name: editName.trim(), phone: editPhone.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success("Profil berhasil diperbarui");
      setActiveDialog(null);
      fetchProfile();

      // Update local session
      const savedSession = localStorage.getItem("auth_session");
      if (savedSession) {
        const s = JSON.parse(savedSession);
        s.user.user_metadata = { ...s.user.user_metadata, full_name: editName.trim() };
        localStorage.setItem("auth_session", JSON.stringify(s));
      }
    } catch {
      toast.error("Gagal memperbarui profil");
    } finally {
      setSavingProfile(false);
    }
  };

  const openSecurity = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPw(false);
    setShowNewPw(false);
    setActiveDialog("security");
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error("Masukkan password lama");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch(`${API_URL}/profile/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal");
      toast.success("Password berhasil diubah");
      setActiveDialog(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal mengubah password";
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  };

  const menuItems = [
    { icon: User, label: "Edit Profil", action: openEditProfile },
    { icon: CalendarClock, label: "Pesanan Saya", action: openMyBookings },
    ...(user?.role === "admin"
      ? [{ icon: LayoutDashboard, label: "Dashboard Admin", action: () => navigate("/admin") }]
      : []),
    { icon: Bell, label: "Notifikasi", action: () => setActiveDialog("notifications") },
    { icon: Shield, label: "Keamanan", action: openSecurity },
    { icon: Settings, label: "Pengaturan", action: () => setActiveDialog("settings") },
    { icon: HelpCircle, label: "Bantuan", action: () => setActiveDialog("help") },
  ];

  async function openMyBookings() {
    setActiveDialog("my-bookings");
    setLoadingBookings(true);
    try {
      const res = await fetch(`${API_URL}/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMyBookings(data);
    } catch (err) {
      toast.error("Gagal mengambil data pesanan");
    } finally {
      setLoadingBookings(false);
    }
  }

  const handleUploadReceipt = async (bookingId: string, file: File) => {
    setUploadingReceipt(bookingId);
    const formData = new FormData();
    formData.append("payment_receipt", file);

    try {
      const res = await fetch(`${API_URL}/bookings/${bookingId}/receipt`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal upload");
      
      toast.success("Bukti transfer berhasil diunggah");
      // Refresh list
      openMyBookings();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunggah bukti transfer");
    } finally {
      setUploadingReceipt(null);
    }
  };

  if (!user) return null;

  const initials = (profile?.full_name || "U")
    .split(" ")
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-8">
      {/* Header */}
      <div className="bg-primary px-4 lg:px-8 flex flex-col justify-center pt-16 pb-12 rounded-b-[2.5rem] shadow-lg shadow-primary/20 relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-black text-white">Profil Pengguna</h1>
            <p className="text-sm text-primary-foreground/80 font-medium">Kelola akun dan pengaturan Anda</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md text-white hover:bg-white/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 lg:px-8 -mt-6 relative z-20 space-y-4 max-w-2xl mx-auto">
        {/* Profile Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xl font-black text-primary">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-slate-900 truncate">{profile?.full_name || "Memuat..."}</h2>
            <p className="text-sm text-slate-500 truncate">{profile?.email || user.email}</p>
            {profile?.phone && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <Phone className="w-3 h-3" /> {profile.phone}
              </p>
            )}
          </div>
        </div>

        {/* Menu Items Card */}
        <div className="bg-white p-3 rounded-3xl shadow-sm border border-slate-100">
          <div className="space-y-1">
            {menuItems.map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                onClick={action}
                className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Icon className="w-5 h-5 text-slate-500 group-hover:text-primary" />
                </div>
                <span className="flex-1 text-sm font-bold text-slate-700 group-hover:text-slate-900">{label}</span>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary" />
              </button>
            ))}
          </div>

          <div className="px-4 py-3 mt-2 border-t border-slate-100">
            <button onClick={handleSignOut} className="w-full flex items-center gap-4 py-3 text-left group">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-red-500" />
              </div>
              <span className="flex-1 text-sm font-bold text-red-600">Keluar Sistem</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Edit Profil Dialog ─── */}
      <Dialog open={activeDialog === "edit-profile"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> Edit Profil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nama Lengkap</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nama lengkap Anda" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nomor Telepon</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="08xxxxxxxxxx" type="tel" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-400">Email</Label>
              <Input value={profile?.email || ""} disabled className="bg-slate-50 text-slate-400" />
              <p className="text-[11px] text-slate-400">Email tidak dapat diubah.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full h-12 rounded-2xl gap-2">
              <Save className="w-4 h-4" /> {savingProfile ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Keamanan Dialog ─── */}
      <Dialog open={activeDialog === "security"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Ubah Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Password Lama</Label>
              <div className="relative">
                <Input
                  type={showCurrentPw ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan password lama"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Password Baru</Label>
              <div className="relative">
                <Input
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Konfirmasi Password Baru</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">Password tidak cocok</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleChangePassword} disabled={savingPassword} className="w-full h-12 rounded-2xl gap-2">
              <Shield className="w-4 h-4" /> {savingPassword ? "Menyimpan..." : "Ubah Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Notifikasi Dialog ─── */}
      <Dialog open={activeDialog === "notifications"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" /> Pengaturan Notifikasi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Notifikasi Booking</p>
                <p className="text-xs text-slate-500 mt-0.5">Terima pemberitahuan saat status booking berubah</p>
              </div>
              <Switch checked={notifBooking} onCheckedChange={setNotifBooking} />
            </div>
            <div className="border-t border-slate-100" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Promo & Penawaran</p>
                <p className="text-xs text-slate-500 mt-0.5">Terima info promo dan diskon terbaru</p>
              </div>
              <Switch checked={notifPromo} onCheckedChange={setNotifPromo} />
            </div>
            <div className="border-t border-slate-100" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Notifikasi Email</p>
                <p className="text-xs text-slate-500 mt-0.5">Kirim notifikasi juga melalui email</p>
              </div>
              <Switch checked={notifEmail} onCheckedChange={setNotifEmail} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                toast.success("Pengaturan notifikasi disimpan");
                setActiveDialog(null);
              }}
              className="w-full h-12 rounded-2xl gap-2"
            >
              <Save className="w-4 h-4" /> Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Pengaturan Dialog ─── */}
      <Dialog open={activeDialog === "settings"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" /> Pengaturan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon className="w-5 h-5 text-slate-600" /> : <Sun className="w-5 h-5 text-amber-500" />}
                <div>
                  <p className="text-sm font-bold text-slate-900">Mode Gelap</p>
                  <p className="text-xs text-slate-500 mt-0.5">Tampilan lebih nyaman di malam hari</p>
                </div>
              </div>
              <Switch checked={darkMode} onCheckedChange={setDarkMode} />
            </div>
            <div className="border-t border-slate-100" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Bahasa</p>
                  <p className="text-xs text-slate-500 mt-0.5">Pilih bahasa tampilan aplikasi</p>
                </div>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="text-sm bg-slate-100 rounded-xl px-3 py-2 font-medium text-slate-700 border-0 outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="id">Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                toast.success("Pengaturan disimpan");
                setActiveDialog(null);
              }}
              className="w-full h-12 rounded-2xl gap-2"
            >
              <Save className="w-4 h-4" /> Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Bantuan Dialog ─── */}
      <Dialog open={activeDialog === "help"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" /> Pusat Bantuan
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="faq-1" className="border-b-0">
                <AccordionTrigger className="text-sm font-bold text-slate-900 hover:no-underline py-4">
                  Bagaimana cara melakukan booking?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 leading-relaxed">
                  Pilih kamar yang Anda inginkan dari halaman utama, tentukan tanggal check-in dan check-out, jumlah
                  tamu, lalu klik "Pesan Sekarang". Ikuti instruksi pembayaran yang muncul untuk menyelesaikan
                  pemesanan.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-2" className="border-b-0">
                <AccordionTrigger className="text-sm font-bold text-slate-900 hover:no-underline py-4">
                  Bisakah saya membatalkan booking?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 leading-relaxed">
                  Pembatalan booking dapat dilakukan dengan menghubungi admin melalui informasi kontak yang tersedia.
                  Kebijakan pembatalan tergantung pada waktu pembatalan relatif terhadap tanggal check-in.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-3" className="border-b-0">
                <AccordionTrigger className="text-sm font-bold text-slate-900 hover:no-underline py-4">
                  Metode pembayaran apa yang tersedia?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 leading-relaxed">
                  Saat ini kami menerima pembayaran melalui Transfer Bank. Detail rekening akan ditampilkan setelah Anda
                  melakukan pemesanan.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-4" className="border-b-0">
                <AccordionTrigger className="text-sm font-bold text-slate-900 hover:no-underline py-4">
                  Jam berapa check-in dan check-out?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 leading-relaxed">
                  Waktu check-in dimulai pukul 14:00 hingga 22:00. Check-out paling lambat pukul 12:00. Informasi
                  lengkap dapat dilihat di halaman detail villa.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-5" className="border-b-0">
                <AccordionTrigger className="text-sm font-bold text-slate-900 hover:no-underline py-4">
                  Bagaimana cara mengubah password?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 leading-relaxed">
                  Buka halaman Profil, lalu klik menu "Keamanan". Anda akan diminta memasukkan password lama dan
                  password baru untuk menggantinya.
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-6 p-5 bg-primary/5 rounded-2xl border border-primary/10">
              <h4 className="text-sm font-bold text-slate-900 mb-2">Masih butuh bantuan?</h4>
              <p className="text-xs text-slate-500 mb-4">Hubungi tim kami melalui salah satu cara berikut:</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-bold text-slate-900">support@bookingvilla.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Telepon</p>
                    <p className="text-sm font-bold text-slate-900">+62 812-xxxx-xxxx</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">WhatsApp</p>
                    <p className="text-sm font-bold text-slate-900">+62 812-xxxx-xxxx</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Pesanan Saya Dialog ─── */}
      <Dialog open={activeDialog === "my-bookings"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" /> Pesanan Saya
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {loadingBookings ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-500">Memuat data pesanan...</p>
              </div>
            ) : myBookings.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <CalendarClock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-bold">Belum ada pesanan</p>
                <Button onClick={() => navigate("/")} variant="link" className="text-primary mt-2">Cari Villa Sekarang</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {myBookings.map((booking) => (
                  <div key={booking.id} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="w-full md:w-32 h-24 rounded-2xl overflow-hidden shrink-0">
                        <img src={booking.villa_image} alt={booking.villa_name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-black text-slate-900 truncate">{booking.villa_name}</h3>
                            <p className="text-xs text-slate-500 mt-1">ID: #{booking.id.slice(0,8)}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            booking.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Check In</p>
                            <p className="text-xs font-bold text-slate-700">{new Date(booking.check_in).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Bayar</p>
                            <p className="text-xs font-black text-primary">Rp {booking.total_price.toLocaleString('id-ID')}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Payment Action */}
                    {booking.status === 'pending' && booking.payment_method === 'Transfer Bank' && (
                      <div className="mt-5 pt-5 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 text-amber-600 bg-amber-50 p-3 rounded-2xl border border-amber-100 flex-1 w-full">
                          <Info className="w-4 h-4 shrink-0" />
                          <p className="text-[11px] font-medium leading-tight">Silakan upload bukti transfer agar pesanan Anda dapat segera dikonfirmasi oleh Admin.</p>
                        </div>
                        <div className="relative w-full md:w-auto">
                          <input
                            type="file"
                            id={`receipt-${booking.id}`}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadReceipt(booking.id, file);
                            }}
                            disabled={uploadingReceipt === booking.id}
                          />
                          <Button 
                            asChild
                            variant={booking.payment_receipt ? "outline" : "default"}
                            className="w-full md:w-auto rounded-xl gap-2 h-11"
                          >
                            <label htmlFor={`receipt-${booking.id}`} className="cursor-pointer">
                              {uploadingReceipt === booking.id ? (
                                <div className="animate-spin w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full" />
                              ) : booking.payment_receipt ? (
                                <><UploadCloud className="w-4 h-4" /> Update Bukti</>
                              ) : (
                                <><CreditCard className="w-4 h-4" /> Upload Bukti</>
                              )}
                            </label>
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {booking.payment_receipt && booking.status !== 'cancelled' && (
                      <div className="mt-4 flex items-center gap-2 text-green-600 bg-green-50/50 p-3 rounded-2xl border border-green-100/50">
                        <UploadCloud className="w-4 h-4" />
                        <span className="text-[11px] font-bold">Bukti transfer sudah diunggah. Menunggu verifikasi admin.</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setActiveDialog(null)} variant="outline" className="w-full rounded-2xl">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
