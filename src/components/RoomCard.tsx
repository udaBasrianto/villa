import { Bath, DoorOpen, Heart, Star, Users, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Room } from "@/data/villas";
import { useAuth } from "@/contexts/AuthContext";
import { toggleFavoriteId, isFavoriteId } from "@/lib/utils";
import { toast } from "sonner";
import { useEffect, useState } from "react";

interface RoomCardProps {
  room: Room;
  index?: number;
  variant?: "basic" | "grid" | "list";
}

const RoomCard = ({ room, index = 0, variant = "basic" }: RoomCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    setFavorite(isFavoriteId(user?.id, room.id));
  }, [user?.id, room.id]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const onToggleFavorite = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const next = toggleFavoriteId(user?.id, room.id);
    setFavorite(next.isFavorite);
    toast.success(next.isFavorite ? "Ditambahkan ke favorit" : "Dihapus dari favorit");
  };

  if (variant === "list") {
    return (
      <div
        onClick={() => navigate(`/villa/${room.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") navigate(`/villa/${room.id}`);
        }}
        role="button"
        tabIndex={0}
        className="w-full text-left bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 animate-slide-up group"
        style={{ animationDelay: `${index * 80}ms`, animationFillMode: "backwards" }}
      >
        <div className="flex">
          <div className="relative w-32 sm:w-36 shrink-0 overflow-hidden">
            <div className="aspect-square">
              <img
                src={room.image}
                alt={room.name}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="absolute top-2 left-2 bg-card/90 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
              <DoorOpen className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-foreground">{room.type}</span>
            </div>
            <button
              type="button"
              onClick={onToggleFavorite}
              className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-sm border transition-colors ${
                favorite ? "bg-destructive text-destructive-foreground border-destructive/30" : "bg-card/90 text-foreground border-border/50"
              }`}
              aria-label={favorite ? "Hapus dari favorit" : "Tambah ke favorit"}
            >
              <Heart className={`w-4 h-4 ${favorite ? "fill-current" : ""}`} />
            </button>
          </div>

          <div className="flex-1 p-3.5 flex flex-col justify-between min-w-0">
            <div>
              <h3 className="font-bold text-foreground text-[15px] leading-tight truncate">{room.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{room.description}</p>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div>
                <span className="text-primary font-bold text-base">{formatPrice(room.price)}</span>
                <span className="text-muted-foreground text-xs"> /malam</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground bg-muted px-2 py-1 rounded-lg">
                <Users className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{room.capacity}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => navigate(`/villa/${room.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") navigate(`/villa/${room.id}`);
      }}
      role="button"
      tabIndex={0}
      className="w-full text-left bg-card rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 animate-slide-up group border border-border/50"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "backwards" }}
    >
      <div className="relative aspect-[4/5] overflow-hidden p-2">
        <img
          src={room.image}
          alt={room.name}
          loading="lazy"
          className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1.5 border border-white/20">
           <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
           <span className="text-xs font-bold text-white tracking-wide">4.9</span>
        </div>
        <button
          type="button"
          onClick={onToggleFavorite}
          className={`absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center shadow-sm border transition-colors ${
            favorite ? "bg-destructive text-destructive-foreground border-destructive/30" : "bg-black/40 text-white border-white/20"
          }`}
          aria-label={favorite ? "Hapus dari favorit" : "Tambah ke favorit"}
        >
          <Heart className={`w-5 h-5 ${favorite ? "fill-current" : ""}`} />
        </button>
      </div>
      <div className="p-4 pt-2">
        <h3 className="font-bold text-foreground text-lg leading-tight truncate">{room.name}</h3>
        
        {/* Detail Fasilitas Mini */}
        <div className="flex items-center gap-2 mt-2 mb-1">
           <div className="flex bg-muted/60 px-2 py-1 rounded-md items-center gap-1">
              <Users className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground">{room.capacity} Org</span>
           </div>
           <div className="flex bg-muted/60 px-2 py-1 rounded-md items-center gap-1">
              <Wifi className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground">WiFi</span>
           </div>
           <div className="flex bg-muted/60 pt-1 pb-1 px-2 rounded-md items-center gap-1">
              <Bath className="w-3 h-3 text-muted-foreground"/>
              <span className="text-[10px] font-bold text-muted-foreground">Bath</span>
           </div>
        </div>

        <div className="flex items-end justify-between mt-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Mulai dari</span>
            <div>
               <span className="text-primary font-black text-lg leading-none">{formatPrice(room.price)}</span>
               <span className="text-muted-foreground text-[10px] font-semibold"> /malam</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary transition-colors">
            <DoorOpen className="w-4 h-4 text-primary group-hover:text-primary-foreground transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomCard;
