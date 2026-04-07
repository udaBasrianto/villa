import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Users, Minus, Plus, Check, CreditCard, Wallet, FileUp, ShieldCheck } from "lucide-react";
import { format, differenceInDays, isWithinInterval, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import type { Room } from "@/data/villas";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { getApiUrl } from "@/lib/utils";

interface BookingSheetProps {
  room: Room;
  children: React.ReactNode;
  onBook?: () => void;
}

interface AvailabilityRow {
  check_in: string;
  check_out: string;
}

const BookingSheet = ({ room, children, onBook }: BookingSheetProps) => {
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [guestCount, setGuestCount] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Transfer Bank");
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookedDates, setBookedDates] = useState<{ start: Date; end: Date }[]>([]);
  const [legalDocs, setLegalDocs] = useState<FileList | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const API_URL = getApiUrl();

  useEffect(() => {
    if (open && room.id) {
      fetch(`${API_URL}/rooms/${room.id}/availability`)
        .then(res => res.json())
        .then((data: AvailabilityRow[]) => {
          const intervals = data.map((b) => ({
            start: parseISO(b.check_in),
            end: parseISO(b.check_out),
          }));
          setBookedDates(intervals);
        })
        .catch(err => console.error("Gagal mengambil ketersediaan:", err));
    }
  }, [open, room.id, API_URL]);

  const isDateBooked = (date: Date) => {
    return bookedDates.some(interval => 
      isWithinInterval(date, { start: interval.start, end: interval.end })
    );
  };

  const nights = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0;
  const childDiscountPerNight = 50000; // Rp 50.000 potongan per anak per malam
  const baseTotalPrice = nights * room.price;
  const totalChildDiscount = nights * childrenCount * childDiscountPerNight;
  const finalTotalPrice = baseTotalPrice - totalChildDiscount;
  const serviceFee = finalTotalPrice * 0.05;
  const grandTotal = finalTotalPrice + serviceFee;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && !user) {
      toast.error("Silakan masuk terlebih dahulu untuk booking");
      navigate("/auth");
      return;
    }
    setOpen(isOpen);
  };

  const handleBook = async () => {
    if (!checkIn || !checkOut || nights < 1) {
      toast.error("Pilih tanggal check-in dan check-out");
      return;
    }

    // Double check overlap on client side
    const hasOverlap = bookedDates.some(interval => {
      const checkInInterval = { start: checkIn, end: checkOut };
      return (
        isWithinInterval(checkIn, interval) ||
        isWithinInterval(checkOut, interval) ||
        isWithinInterval(interval.start, checkInInterval)
      );
    });

    if (hasOverlap) {
      toast.error("Maaf, tanggal yang Anda pilih sudah dipesan.");
      return;
    }

    if (!user) {
      toast.error("Silakan masuk terlebih dahulu");
      navigate("/auth");
      return;
    }

    if (guestCount > 1 && (!legalDocs || legalDocs.length === 0)) {
      toast.error("Wajib mengunggah KTP & Buku Nikah untuk pasangan");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const formData = new FormData();
      
      formData.append("room_id", room.id);
      formData.append("room_name", room.name);
      formData.append("room_image", room.image);
      formData.append("check_in", format(checkIn, "yyyy-MM-dd"));
      formData.append("check_out", format(checkOut, "yyyy-MM-dd"));
      formData.append("guests", guestCount.toString());
      formData.append("children", childrenCount.toString());
      formData.append("payment_method", paymentMethod);
      formData.append("total_price", Math.round(grandTotal).toString());
      formData.append("child_discount", totalChildDiscount.toString());

      if (legalDocs) {
        for (let i = 0; i < legalDocs.length; i++) {
          formData.append("legal_docs", legalDocs[i]);
        }
      }

      const response = await fetch(`${API_URL}/bookings`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Gagal membuat booking");
      }

      onBook?.();
      setSuccess(true);
      toast.success("Booking berhasil dikonfirmasi!");

      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setCheckIn(undefined);
        setCheckOut(undefined);
        setGuestCount(2);
        setChildrenCount(0);
        setPaymentMethod("Transfer Bank");
        setLegalDocs(null);
      }, 1500);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto w-full max-w-[14in] mx-auto">
        {success ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <Check className="w-8 h-8 text-secondary-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Booking Berhasil!</h3>
            <p className="text-muted-foreground text-sm text-center max-w-[240px]">
              Pesanan Anda telah dikonfirmasi. Anda dapat melihat detailnya di halaman Booking.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 py-4">
            <SheetHeader className="text-left">
              <SheetTitle className="text-xl font-bold text-foreground">Booking {room.name}</SheetTitle>
            </SheetHeader>

            <div className="space-y-4">
              {/* Date Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Check In</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal h-12 rounded-xl bg-muted/50 border-none">
                        <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                        {checkIn ? format(checkIn, "d MMM yyyy", { locale: id }) : <span className="text-muted-foreground">Pilih tanggal</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl" align="start">
                      <Calendar 
                        mode="single" 
                        selected={checkIn} 
                        onSelect={setCheckIn} 
                        disabled={(date) => date < new Date() || isDateBooked(date)} 
                        initialFocus 
                        locale={id} 
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Check Out</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal h-12 rounded-xl bg-muted/50 border-none">
                        <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                        {checkOut ? format(checkOut, "d MMM yyyy", { locale: id }) : <span className="text-muted-foreground">Pilih tanggal</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl" align="start">
                      <Calendar 
                        mode="single" 
                        selected={checkOut} 
                        onSelect={setCheckOut} 
                        disabled={(date) => (checkIn ? date <= checkIn : date < new Date()) || isDateBooked(date)} 
                        initialFocus 
                        locale={id} 
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Guest Count */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Dewasa</label>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl h-12">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{guestCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setGuestCount(Math.max(1, guestCount - 1))} className="w-7 h-7 rounded-full bg-card flex items-center justify-center text-foreground shadow-sm">
                        <Minus className="w-3 h-3" />
                      </button>
                      <button onClick={() => setGuestCount(guestCount + 1)} className="w-7 h-7 rounded-full bg-card flex items-center justify-center text-foreground shadow-sm">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Anak-anak</label>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl h-12">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{childrenCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))} className="w-7 h-7 rounded-full bg-card flex items-center justify-center text-foreground shadow-sm">
                        <Minus className="w-3 h-3" />
                      </button>
                      <button onClick={() => setChildrenCount(childrenCount + 1)} className="w-7 h-7 rounded-full bg-card flex items-center justify-center text-foreground shadow-sm">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Metode Pembayaran</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod("Transfer Bank")}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                      paymentMethod === "Transfer Bank"
                        ? "border-primary bg-primary/5"
                        : "border-muted bg-transparent hover:border-muted-foreground/20"
                    }`}
                  >
                    <CreditCard className={`w-5 h-5 ${paymentMethod === "Transfer Bank" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-[11px] font-bold uppercase tracking-tight ${paymentMethod === "Transfer Bank" ? "text-primary" : "text-muted-foreground"}`}>
                      Transfer Bank
                    </span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("Bayar di Tempat")}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                      paymentMethod === "Bayar di Tempat"
                        ? "border-primary bg-primary/5"
                        : "border-muted bg-transparent hover:border-muted-foreground/20"
                    }`}
                  >
                    <Wallet className={`w-5 h-5 ${paymentMethod === "Bayar di Tempat" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-[11px] font-bold uppercase tracking-tight ${paymentMethod === "Bayar di Tempat" ? "text-primary" : "text-muted-foreground"}`}>
                      Bayar di Tempat
                    </span>
                  </button>
                </div>
              </div>

              {/* Legal Documents Upload */}
              <div className="space-y-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2 text-amber-800">
                  <ShieldCheck className="w-5 h-5" />
                  <label className="text-xs font-bold uppercase tracking-wider">Syarat & Ketentuan Syariah</label>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                  Sebagai Villa Syariah, kami mewajibkan pasangan untuk melampirkan foto **KTP masing-masing** dan **Buku Nikah / Akte Nikah** yang sah.
                </p>
                <div className="space-y-2 mt-2">
                  <div className="relative">
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*,.pdf" 
                      onChange={(e) => setLegalDocs(e.target.files)}
                      className="hidden"
                      id="legal-docs-upload"
                    />
                    <label 
                      htmlFor="legal-docs-upload"
                      className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-white border-2 border-dashed border-amber-200 text-amber-700 hover:border-amber-400 hover:bg-amber-100/50 cursor-pointer transition-all"
                    >
                      <FileUp className="w-4 h-4" />
                      <span className="text-xs font-bold">
                        {legalDocs ? `${legalDocs.length} File Terpilih` : "Upload KTP & Buku Nikah"}
                      </span>
                    </label>
                  </div>
                  {legalDocs && (
                    <div className="flex flex-wrap gap-1">
                      {Array.from(legalDocs).map((file, idx) => (
                        <div key={idx} className="text-[9px] bg-amber-200/50 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                          {file.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Price Summary */}
              {nights > 0 && (
                <div className="mt-4 p-4 rounded-2xl bg-secondary/10 border border-secondary/20">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      {formatPrice(room.price)} x {nights} malam
                    </span>
                    <span className="font-medium text-foreground">{formatPrice(baseTotalPrice)}</span>
                  </div>
                  
                  {childrenCount > 0 && (
                    <div className="flex justify-between text-sm mb-2 text-green-600 font-medium">
                      <span>Potongan Harga Anak ({childrenCount} anak)</span>
                      <span>-{formatPrice(totalChildDiscount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-muted-foreground">Biaya layanan (5%)</span>
                    <span className="font-medium text-foreground">{formatPrice(serviceFee)}</span>
                  </div>
                  <div className="pt-3 border-t border-secondary/20 flex justify-between">
                    <span className="font-bold text-foreground">Total Pembayaran</span>
                    <span className="font-bold text-primary text-lg">{formatPrice(grandTotal)}</span>
                  </div>
                </div>
              )}

              <Button onClick={handleBook} className="w-full h-14 rounded-2xl text-lg font-bold mt-4" disabled={loading || !checkIn || !checkOut}>
                {loading ? "Memproses..." : "Konfirmasi Booking"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default BookingSheet;
