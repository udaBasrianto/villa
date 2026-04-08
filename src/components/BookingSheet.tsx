import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Users, Minus, Plus, Check, CreditCard, Wallet, FileUp, ShieldCheck } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import type { Room } from "@/data/villas";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { getApiUrl } from "@/lib/utils";

interface BookingSheetProps {
  room: Room;
  children: React.ReactNode;
  onBook?: () => void;
}

interface AvailabilityRow {
  check_in: string;
  check_out: string;
  status?: string;
}

interface AvailabilityResponse {
  total_units: number;
  bookings: AvailabilityRow[];
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
  const [totalUnits, setTotalUnits] = useState(1);
  const [bookings, setBookings] = useState<AvailabilityRow[]>([]);
  const [legalDocs, setLegalDocs] = useState<FileList | null>(null);
  const [syariahEnabled, setSyariahEnabled] = useState(true);
  const [syariahPolicy, setSyariahPolicy] = useState<string>("");
  const [syariahAgreed, setSyariahAgreed] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const API_URL = getApiUrl();

  useEffect(() => {
    if (open && room.id) {
      fetch(`${API_URL}/villa-info`)
        .then((res) => res.json())
        .then((data) => {
          setSyariahEnabled(Boolean(data?.syariah_enabled ?? true));
          setSyariahPolicy(typeof data?.syariah_policy === "string" ? data.syariah_policy : "");
        })
        .catch(() => {});

      fetch(`${API_URL}/rooms/${room.id}/availability`)
        .then(res => res.json())
        .then((data: AvailabilityResponse) => {
          setTotalUnits(Math.max(1, Number(data?.total_units || 0) || 1));
          setBookings(Array.isArray(data?.bookings) ? data.bookings : []);
        })
        .catch(err => console.error("Gagal mengambil ketersediaan:", err));
    }
  }, [open, room.id, API_URL]);

  const countBookingsForDate = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return bookings.reduce((count, b) => {
      const start = parseISO(b.check_in);
      const end = parseISO(b.check_out);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return d >= start && d < end ? count + 1 : count;
    }, 0);
  };

  const isDateFullyBooked = (date: Date) => countBookingsForDate(date) >= totalUnits;

  const getMaxOverlapForRange = (start: Date, end: Date) => {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(0, 0, 0, 0);
    let max = 0;
    for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) {
      const c = countBookingsForDate(d);
      if (c > max) max = c;
      if (max >= totalUnits) return max;
    }
    return max;
  };

  const nights = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0;
  const childDiscountPerNight = 50000; // Rp 50.000 potongan per anak per malam
  const baseTotalPrice = nights * room.price;
  const totalChildDiscount = nights * childrenCount * childDiscountPerNight;
  const finalTotalPrice = baseTotalPrice - totalChildDiscount;
  const serviceFee = finalTotalPrice * 0.05;
  const grandTotal = finalTotalPrice + serviceFee;
  const selectedMaxOverlap = checkIn && checkOut && nights > 0 ? getMaxOverlapForRange(checkIn, checkOut) : 0;
  const remainingUnits = Math.max(0, totalUnits - selectedMaxOverlap);

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

    const maxOverlap = getMaxOverlapForRange(checkIn, checkOut);
    if (maxOverlap >= totalUnits) {
      toast.error("Maaf, kamar sudah penuh untuk tanggal yang Anda pilih.");
      return;
    }

    if (!user) {
      toast.error("Silakan masuk terlebih dahulu");
      navigate("/auth");
      return;
    }

    if (syariahEnabled && !syariahAgreed) {
      toast.error("Wajib menyetujui kebijakan syariah sebelum booking");
      return;
    }

    if (syariahEnabled && guestCount >= 2 && (!legalDocs || legalDocs.length === 0)) {
      toast.error("Wajib mengunggah dokumen identitas untuk verifikasi syariah");
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
      formData.append("syariah_agreed", syariahEnabled ? (syariahAgreed ? "1" : "0") : "0");

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
      const data = await response.json().catch(() => ({}));

      onBook?.();
      setSuccess(true);
      toast.success(data?.status === "pending_verification" ? "Booking dibuat. Menunggu verifikasi syariah admin." : "Booking berhasil dibuat!");

      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setCheckIn(undefined);
        setCheckOut(undefined);
        setGuestCount(2);
        setChildrenCount(0);
        setPaymentMethod("Transfer Bank");
        setLegalDocs(null);
        setSyariahAgreed(false);
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
                        disabled={(date) => date < new Date() || isDateFullyBooked(date)} 
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
                        disabled={(date) => (checkIn ? date <= checkIn : date < new Date()) || isDateFullyBooked(date)} 
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
              {syariahEnabled && (
                <div className="space-y-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                  <div className="flex items-center gap-2 text-amber-800">
                    <ShieldCheck className="w-5 h-5" />
                    <label className="text-xs font-bold uppercase tracking-wider">Kebijakan Syariah</label>
                  </div>

                  <div className="space-y-2">
                    {(syariahPolicy || "")
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .slice(0, 8)
                      .map((line) => (
                        <div key={line} className="flex items-start gap-2 text-[11px] text-amber-700 leading-relaxed font-medium">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />
                          <span>{line}</span>
                        </div>
                      ))}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Checkbox
                      id="syariah_agree"
                      checked={syariahAgreed}
                      onCheckedChange={(v) => setSyariahAgreed(v === true)}
                    />
                    <Label htmlFor="syariah_agree" className="text-[11px] font-bold text-amber-800">
                      Saya setuju dengan kebijakan syariah
                    </Label>
                  </div>

                  <div className="space-y-2 mt-2">
                    <div className="text-[11px] text-amber-700 leading-relaxed font-medium">
                      Verifikasi dokumen diperlukan untuk booking 2 dewasa atau lebih.
                    </div>
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
                          {legalDocs ? `${legalDocs.length} File Terpilih` : "Upload Dokumen Identitas"}
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
              )}

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
                  <div className="mt-2 flex items-center justify-between text-[11px] font-bold">
                    <span className="text-muted-foreground">Ketersediaan</span>
                    <span className={remainingUnits > 0 ? "text-green-600" : "text-red-600"}>
                      Sisa {remainingUnits}/{totalUnits} unit
                    </span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleBook}
                className="w-full h-14 rounded-2xl text-lg font-bold mt-4"
                disabled={loading || !checkIn || !checkOut || remainingUnits < 1 || (syariahEnabled && !syariahAgreed)}
              >
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
