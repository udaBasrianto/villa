import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, MapPin, Bed, Bath, Users, Wifi, Waves, Wind, UtensilsCrossed, Car, TreePine, Share2, Heart, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Room, VillaInfo } from "@/data/villas";
import BookingSheet from "@/components/BookingSheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { isFavoriteId, toggleFavoriteId } from "@/lib/utils";

const amenityIcons: Record<string, typeof Wifi> = {
  WiFi: Wifi, Pool: Waves, AC: Wind, Kitchen: UtensilsCrossed,
  Parking: Car, Garden: TreePine, "Beach Access": Waves, BBQ: UtensilsCrossed,
  "Yoga Deck": TreePine, Fireplace: Wind, Spa: Waves, Gym: Users,
  "King Bed": Bed, "Twin Beds": Bed, "Bathtub": Bath, "Minibar": UtensilsCrossed
};

interface ReviewRow {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user_name: string;
}

interface VillaPolicies {
  check_in_start: string;
  check_in_end: string;
  check_out_time: string;
  no_smoking: boolean;
  rules: string[];
}

const VillaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [villaData, setVillaData] = useState<VillaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewSummary, setReviewSummary] = useState<{ avgRating: number; total: number }>({ avgRating: 0, total: 0 });
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [policies, setPolicies] = useState<VillaPolicies | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [favorite, setFavorite] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [roomRes, villaRes] = await Promise.all([
          fetch(`${API_URL}/rooms/${id}`),
          fetch(`${API_URL}/villa-info`)
        ]);
        const roomData = await roomRes.json();
        const villaData = await villaRes.json();
        
        // Handle JSON fields for room
        if (roomData.amenities && typeof roomData.amenities === 'string') {
          roomData.amenities = JSON.parse(roomData.amenities);
        }
        if (roomData.images && typeof roomData.images === 'string') {
          roomData.images = JSON.parse(roomData.images);
        }
        
        setRoom(roomData);
        setVillaData(villaData);
      } catch (error) {
        console.error("Gagal mengambil data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, API_URL]);

  useEffect(() => {
    if (!id) return;
    setFavorite(isFavoriteId(user?.id, id));
  }, [user?.id, id]);

  const fetchPolicies = useCallback(async () => {
    setPoliciesLoading(true);
    try {
      const res = await fetch(`${API_URL}/villa-policies`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as VillaPolicies | null;
      setPolicies(data);
    } catch (error) {
      setPolicies(null);
    } finally {
      setPoliciesLoading(false);
    }
  }, [API_URL]);

  const fetchReviews = useCallback(async () => {
    if (!id) return;
    setReviewsLoading(true);
    try {
      const res = await fetch(`${API_URL}/rooms/${id}/reviews`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReviewSummary(data.summary || { avgRating: 0, total: 0 });
      setReviews(data.reviews || []);
    } catch (error) {
      setReviewSummary({ avgRating: 0, total: 0 });
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [API_URL, id]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const submitReview = async () => {
    if (!id) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (myRating < 1 || myRating > 5) {
      toast.error("Pilih rating 1-5");
      return;
    }
    if (myComment.trim().length < 3) {
      toast.error("Tulis review minimal 3 karakter");
      return;
    }

    setSubmittingReview(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/rooms/${id}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ rating: myRating, comment: myComment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Gagal mengirim review");
      toast.success("Review terkirim");
      setMyComment("");
      setMyRating(0);
      fetchReviews();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Gagal mengirim review");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading || !room || !villaData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);

  const getBedLabel = (amenities: string[]) => {
    const normalized = amenities.map((a) => a.toLowerCase());
    const includes = (needle: string) => normalized.some((a) => a.includes(needle));

    if (includes("king bed")) return "King Bed";
    if (includes("twin")) return "Twin Beds";
    const queenAmenity = amenities.find((a) => a.toLowerCase().includes("queen"));
    if (queenAmenity) return queenAmenity;
    return "Bed";
  };

  const bedLabel = getBedLabel(room.amenities || []);
  const rawVerified = (room as unknown as { is_verified?: unknown }).is_verified;
  const isVerified =
    typeof rawVerified === "number"
      ? Boolean(rawVerified)
      : typeof rawVerified === "boolean"
        ? rawVerified
        : (room.images?.length || 0) >= 2 && (room.amenities?.length || 0) >= 4 && (room.description?.length || 0) >= 40;

  const headerRatingText =
    reviewSummary.total > 0 ? reviewSummary.avgRating.toFixed(1) : Number(villaData.rating).toFixed(1);

  const formatClock = (time: string) => (time ? String(time).slice(0, 5) : "");
  const policyRules = (() => {
    const base = policies?.rules && Array.isArray(policies.rules) ? [...policies.rules] : [];
    if (policies?.no_smoking) {
      const hasNoSmoking = base.some((r) => r.toLowerCase().includes("merokok"));
      if (!hasNoSmoking) base.push("Dilarang merokok di dalam kamar");
    }
    return base;
  })();

  return (
    <div className="min-h-screen bg-background pb-28 flex justify-center">
      <div className="w-full max-w-[14in] bg-background relative min-h-screen">
        {/* Image Header */}
        <div className="relative h-[300px] md:h-[500px]">
          {room.images && room.images.length > 0 ? (
            <Carousel
              plugins={[Autoplay({ delay: 3500, stopOnInteraction: true })]}
              opts={{ loop: true }}
              className="w-full h-full absolute inset-0"
            >
              <CarouselContent className="h-full">
                {room.images.map((img: string, idx: number) => {
                  const imgSrc = img.startsWith('http') ? img : `${API_URL.replace('/api', '')}${img.startsWith('/') ? img : '/' + img}`;
                  return (
                    <CarouselItem key={idx} className="h-full">
                      <img src={imgSrc} alt={`${room.name} foto ${idx + 1}`} className="w-full h-full object-cover" />
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
              {room.images.length > 1 && (
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-4 pointer-events-none z-20">
                  <CarouselPrevious className="pointer-events-auto static translate-x-0 translate-y-0 bg-black/20 hover:bg-black/40 border-none text-white h-10 w-10 backdrop-blur-md" />
                  <CarouselNext className="pointer-events-auto static translate-x-0 translate-y-0 bg-black/20 hover:bg-black/40 border-none text-white h-10 w-10 backdrop-blur-md" />
                </div>
              )}
            </Carousel>
          ) : (
            <img src={room.image?.startsWith('http') ? room.image : `${API_URL.replace('/api', '')}${room.image?.startsWith('/') ? room.image : '/' + room.image}`} alt={room.name} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pt-6 z-10">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex gap-2">
              <button className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
                <Share2 className="w-5 h-5 text-foreground" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!id) return;
                  const next = toggleFavoriteId(user?.id, id);
                  setFavorite(next.isFavorite);
                  toast.success(next.isFavorite ? "Ditambahkan ke favorit" : "Dihapus dari favorit");
                }}
                className={`w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center shadow-sm ${
                  favorite ? "text-destructive" : "text-foreground"
                }`}
                aria-label={favorite ? "Hapus dari favorit" : "Tambah ke favorit"}
              >
                <Heart className={`w-5 h-5 ${favorite ? "fill-current" : ""}`} />
              </button>
            </div>
          </div>
          
          {/* Room Type Badge */}
          <div className="absolute bottom-10 left-5">
            <div className="bg-primary/90 text-primary-foreground text-[10px] font-bold uppercase px-3 py-1 rounded-full tracking-widest shadow-lg">
              {room.type}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative -mt-6 bg-background rounded-t-[32px] px-5 pt-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">{room.name}</h1>
              <div className="flex items-center gap-1.5 mt-2 text-muted-foreground font-medium">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm">{villaData.name}, {villaData.location}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-accent/10 px-3 py-2 rounded-2xl border border-accent/20">
              <Star className="w-4 h-4 text-accent fill-accent" />
              <span className="text-sm font-bold text-foreground">{headerRatingText}</span>
            </div>
          </div>

          {/* Quick Info Bar */}
          <div className="grid grid-cols-3 gap-3 mt-8 p-4 rounded-3xl bg-muted/50 border border-border">
            <div className="flex flex-col items-center gap-1">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-[11px] font-bold text-foreground uppercase tracking-tighter">{room.capacity} Tamu</span>
            </div>
            <div className="flex flex-col items-center gap-1 border-x border-border/50">
              <Bed className="w-5 h-5 text-primary" />
              <span className="text-[11px] font-bold text-foreground uppercase tracking-tighter">{bedLabel}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span className="text-[11px] font-bold text-foreground uppercase tracking-tighter">
                {isVerified ? "Verified" : "Standard"}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="mt-8">
            <h2 className="text-lg font-bold text-foreground mb-3">Deskripsi Kamar</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {room.description}
            </p>
          </div>

          {/* Amenities */}
          <div className="mt-8">
            <h2 className="text-lg font-bold text-foreground mb-4">Fasilitas Kamar</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {room.amenities.map((amenity) => {
                const Icon = amenityIcons[amenity] || Wifi;
                return (
                  <div key={amenity} className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-card border border-border shadow-sm">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary shrink-0" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">{amenity}</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Villa Rules Info */}
          <div className="mt-8 p-5 rounded-3xl bg-secondary/5 border border-secondary/10">
            <h2 className="text-base font-bold text-foreground mb-3">Kebijakan Villa</h2>
            {policiesLoading ? (
              <div className="space-y-2">
                <div className="h-3 w-56 bg-secondary/10 rounded animate-pulse" />
                <div className="h-3 w-40 bg-secondary/10 rounded animate-pulse" />
                <div className="h-3 w-64 bg-secondary/10 rounded animate-pulse" />
              </div>
            ) : (
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-1" />
                  <span>
                    Check-in: {formatClock(policies?.check_in_start || "14:00")} - {formatClock(policies?.check_in_end || "22:00")}
                  </span>
                </li>
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-1" />
                  <span>
                    Check-out: {formatClock(policies?.check_out_time || "12:00")}
                  </span>
                </li>
                {policyRules.map((rule) => (
                  <li key={rule} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-1" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Review</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {reviewSummary.total > 0 ? `${reviewSummary.total} ulasan` : "Belum ada ulasan"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-accent/10 px-3 py-2 rounded-2xl border border-accent/20">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <span className="text-sm font-bold text-foreground">
                  {reviewSummary.total > 0 ? reviewSummary.avgRating.toFixed(1) : "0.0"}
                </span>
              </div>
            </div>

            <div className="mt-5 p-4 rounded-3xl bg-card border border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">Tulis review kamu</span>
                {!user && (
                  <button onClick={() => navigate("/auth")} className="text-xs font-bold text-primary">
                    Masuk dulu
                  </button>
                )}
              </div>

              <div className="mt-4 flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, idx) => {
                  const value = idx + 1;
                  const isActive = value <= myRating;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMyRating(value)}
                      className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"
                      disabled={!user}
                    >
                      <Star className={isActive ? "w-5 h-5 text-accent fill-accent" : "w-5 h-5 text-muted-foreground"} />
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                <Textarea
                  value={myComment}
                  onChange={(e) => setMyComment(e.target.value)}
                  placeholder="Ceritakan pengalaman kamu..."
                  className="rounded-2xl min-h-[110px]"
                  disabled={!user}
                />
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  onClick={submitReview}
                  className="rounded-2xl"
                  disabled={!user || submittingReview}
                >
                  {submittingReview ? "Mengirim..." : "Kirim Review"}
                </Button>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {reviewsLoading ? (
                <div className="bg-muted/50 rounded-3xl p-5 border border-border">
                  <div className="animate-pulse h-4 w-40 bg-muted rounded" />
                  <div className="animate-pulse h-3 w-full bg-muted rounded mt-3" />
                  <div className="animate-pulse h-3 w-2/3 bg-muted rounded mt-2" />
                </div>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="bg-card rounded-3xl p-5 border border-border">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{r.user_name || "User"}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {format(new Date(r.created_at), "d MMM yyyy", { locale: idLocale })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full">
                        <Star className="w-3.5 h-3.5 text-accent fill-accent" />
                        <span className="text-xs font-bold text-foreground">{r.rating}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                      {r.comment}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t border-border z-50">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-4 safe-bottom flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center justify-between sm:block">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Harga Kamar</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-black text-primary">{formatPrice(room.price)}</span>
                <span className="text-muted-foreground text-xs font-medium">/malam</span>
              </div>
            </div>
            <BookingSheet room={room}>
              <Button className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-10 rounded-2xl text-sm sm:text-base font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all">
                Booking Kamar
              </Button>
            </BookingSheet>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VillaDetail;
