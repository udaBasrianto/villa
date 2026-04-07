import { useState, useEffect } from "react";
import { Search, X, Calendar as CalendarIcon, Check } from "lucide-react";
import RoomCard from "@/components/RoomCard";
import { Room } from "@/data/villas";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { getApiUrl } from "@/lib/utils";

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const checkIn = searchParams.get("checkin");
  const checkOut = searchParams.get("checkout");
  const onlyAvailable = searchParams.get("available") === "true";

  const API_URL = getApiUrl();

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch(`${API_URL}/rooms`);
        const data = await res.json();
        setRooms(data);
      } catch (error) {
        console.error("Gagal mengambil data kamar:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, [API_URL]);

  const filtered = rooms.filter((r) => {
    const matchesQuery = r.name.toLowerCase().includes(query.toLowerCase()) ||
                        r.description.toLowerCase().includes(query.toLowerCase());

    return matchesQuery;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Cari Kamar</h1>
      </div>

      {/* Search Bar */}
      <div className="px-5">
        <div className="flex items-center gap-3 bg-muted rounded-2xl px-4 py-3">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari tipe kamar atau fasilitas..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {(checkIn || checkOut || onlyAvailable) && (
        <div className="px-5 flex flex-wrap gap-2 mt-4">
          {checkIn && (
            <Badge variant="secondary" className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 bg-primary/10 text-primary border-none">
              <CalendarIcon className="w-3 h-3" />
              IN: {format(parseISO(checkIn), "dd MMM", { locale: id })}
            </Badge>
          )}
          {checkOut && (
            <Badge variant="secondary" className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 bg-primary/10 text-primary border-none">
              <CalendarIcon className="w-3 h-3" />
              OUT: {format(parseISO(checkOut), "dd MMM", { locale: id })}
            </Badge>
          )}
          {onlyAvailable && (
            <Badge variant="secondary" className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 border-none">
              <Check className="w-3 h-3" />
              Tersedia Saja
            </Badge>
          )}
          <button 
            onClick={() => setSearchParams({})}
            className="text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            Hapus Semua
          </button>
        </div>
      )}

      {/* Results */}
      <div className="px-5 mt-6">
        <p className="text-sm text-muted-foreground mb-4">
          {filtered.length} tipe kamar ditemukan
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((room, i) => (
            <RoomCard key={room.id} room={room} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
