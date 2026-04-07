import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { Room } from "@/data/villas";
import RoomCard from "@/components/RoomCard";
import { readFavoriteIds } from "@/lib/utils";

const Favorites = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    setFavoriteIds(readFavoriteIds(user?.id));
  }, [user?.id]);

  useEffect(() => {
    const onStorage = () => setFavoriteIds(readFavoriteIds(user?.id));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user?.id]);

  useEffect(() => {
    const onUpdated = () => setFavoriteIds(readFavoriteIds(user?.id));
    window.addEventListener("favorites:updated", onUpdated as EventListener);
    return () => window.removeEventListener("favorites:updated", onUpdated as EventListener);
  }, [user?.id]);

  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true);
      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
        const res = await fetch(`${API_URL}/rooms`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as Array<Record<string, unknown>>;
        const normalized = data.map((r) => {
          const amenitiesRaw = r.amenities;
          const imagesRaw = r.images;
          return {
            ...(r as unknown as Room),
            amenities: (typeof amenitiesRaw === "string" ? JSON.parse(amenitiesRaw) : amenitiesRaw) as string[],
            images: (typeof imagesRaw === "string" ? JSON.parse(imagesRaw) : imagesRaw) as string[],
          };
        });
        setRooms(normalized);
      } catch {
        setRooms([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, []);

  const favoriteRooms = useMemo(() => {
    const set = new Set(favoriteIds);
    return rooms.filter((r) => set.has(r.id));
  }, [rooms, favoriteIds]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Favorit</h1>
        <p className="text-sm text-muted-foreground mt-1">Villa yang Anda simpan</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : favoriteRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-20">
          <Heart className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="font-bold text-foreground text-lg">Belum Ada Favorit</h3>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Tap ikon hati pada villa yang Anda sukai
          </p>
        </div>
      ) : (
        <div className="px-5 space-y-4">
          {favoriteRooms.map((room, i) => (
            <RoomCard key={room.id} room={room} index={i} variant="list" />
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
