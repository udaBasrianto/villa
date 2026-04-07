import { Star, MapPin, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Villa } from "@/data/villas";

interface VillaCardProps {
  villa: Villa;
  index?: number;
}

const VillaCard = ({ villa, index = 0 }: VillaCardProps) => {
  const navigate = useNavigate();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <button
      onClick={() => navigate(`/villa/${villa.id}`)}
      className="w-full text-left bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 animate-slide-up group"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "backwards" }}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={villa.image}
          alt={villa.name}
          loading="lazy"
          width={800}
          height={600}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1">
          <Star className="w-3.5 h-3.5 text-accent fill-accent" />
          <span className="text-xs font-semibold text-foreground">{villa.rating}</span>
        </div>
      </div>
      <div className="p-3.5">
        <h3 className="font-bold text-foreground text-[15px] leading-tight truncate">{villa.name}</h3>
        <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs truncate">{villa.location}</span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div>
            <span className="text-primary font-bold text-base">{formatPrice(villa.price)}</span>
            <span className="text-muted-foreground text-xs"> /malam</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span className="text-xs">{villa.guests}</span>
          </div>
        </div>
      </div>
    </button>
  );
};

export default VillaCard;
