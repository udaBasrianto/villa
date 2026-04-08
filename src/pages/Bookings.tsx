import { useState, useEffect } from "react";
import { CalendarDays, CreditCard, QrCode } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { getApiUrl } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BookingRow {
  id: string;
  villa_id: string;
  villa_name: string;
  villa_image: string;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  payment_method: string;
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  confirmed: "bg-secondary text-secondary-foreground",
  pending: "bg-accent text-accent-foreground",
  pending_verification: "bg-amber-100 text-amber-800",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  confirmed: "Dikonfirmasi",
  pending: "Menunggu",
  pending_verification: "Verifikasi Syariah",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const Bookings = () => {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/auth");
      return;
    }
    const fetchBookings = async () => {
      try {
        const API_URL = getApiUrl();
        const token = localStorage.getItem("auth_token");
        if (!token) throw new Error("Token tidak ditemukan");

        const response = await fetch(`${API_URL}/bookings`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error("Gagal mengambil data booking");

        const raw = (await response.json()) as Array<Record<string, unknown>>;
        const normalized = raw.map((b) => ({
          id: String(b.id ?? ""),
          villa_id: String((b.villa_id ?? b.room_id) ?? ""),
          villa_name: String((b.villa_name ?? b.room_name) ?? ""),
          villa_image: String((b.villa_image ?? b.room_image) ?? ""),
          check_in: String(b.check_in ?? ""),
          check_out: String(b.check_out ?? ""),
          guests: Number(b.guests ?? 0),
          total_price: Number(b.total_price ?? 0),
          payment_method: String(b.payment_method ?? ""),
          status: String(b.status ?? ""),
          created_at: String(b.created_at ?? ""),
        }));
        setBookings(normalized);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [user, navigate, authLoading]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Booking Saya</h1>
        <p className="text-sm text-muted-foreground mt-1">Riwayat dan booking aktif</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-20">
          <CalendarDays className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="font-bold text-foreground text-lg">Belum Ada Booking</h3>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Mulai jelajahi villa dan buat booking pertama Anda
          </p>
        </div>
      ) : (
        <div className="px-5 space-y-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="bg-card rounded-2xl overflow-hidden shadow-card animate-slide-up">
              <div className="flex gap-3 p-3">
                <img src={booking.villa_image} alt={booking.villa_name} loading="lazy" className="w-24 h-24 rounded-xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-foreground text-sm truncate">{booking.villa_name}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusColors[booking.status] || ""}`}>
                      {statusLabels[booking.status] || booking.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                    <CalendarDays className="w-3 h-3" />
                    <span className="text-xs">
                      {format(new Date(booking.check_in), "d MMM", { locale: idLocale })} -{" "}
                      {format(new Date(booking.check_out), "d MMM yyyy", { locale: idLocale })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <CreditCard className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{booking.payment_method}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-primary font-bold text-sm">{formatPrice(booking.total_price)}</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-2 text-[10px] gap-1 border-primary/20 hover:border-primary text-primary hover:bg-primary/5"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <QrCode className="w-3 h-3" />
                      QR Code
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog QR Code */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="sm:max-w-md max-w-[90vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">QR Code Booking</DialogTitle>
            <DialogDescription className="text-center">
              Tunjukkan QR Code ini kepada petugas saat check-in.
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="flex flex-col items-center justify-center p-6 space-y-4">
              <div className="p-4 bg-white rounded-xl shadow-sm border border-border">
                <QRCodeCanvas 
                  value={selectedBooking.id} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <div className="text-center space-y-1">
                <p className="font-bold text-foreground">{selectedBooking.villa_name}</p>
                <p className="text-xs text-muted-foreground font-mono bg-muted py-1 px-3 rounded-full">
                  ID: {selectedBooking.id}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full text-center text-sm pt-2">
                <div className="bg-muted/50 p-2 rounded-lg">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Check-in</p>
                  <p className="font-semibold text-xs">{format(new Date(selectedBooking.check_in), "d MMM yyyy", { locale: idLocale })}</p>
                </div>
                <div className="bg-muted/50 p-2 rounded-lg">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Check-out</p>
                  <p className="font-semibold text-xs">{format(new Date(selectedBooking.check_out), "d MMM yyyy", { locale: idLocale })}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Bookings;
