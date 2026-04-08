import room1 from "@/assets/villa1.jpg";
import room2 from "@/assets/villa2.jpg";
import room3 from "@/assets/villa3.jpg";
import room4 from "@/assets/villa4.jpg";

export interface VillaInfo {
  name: string;
  location: string;
  description: string;
  image: string;
  rating: number;
  reviews: number;
  theme_color?: string;
  app_name?: string;
  app_logo_url?: string;
  syariah_enabled?: number | boolean;
  syariah_policy?: string;
}

export const villaInfo: VillaInfo = {
  name: "Villa Sunset Paradise",
  location: "Ubud, Bali",
  description: "Villa mewah eksklusif dengan kolam renang infinity dan pemandangan sawah yang menakjubkan. Terletak di jantung Ubud, dekat dengan restoran dan atraksi wisata populer.",
  image: room1,
  rating: 4.9,
  reviews: 128,
};

export interface Room {
  id: string;
  name: string;
  type: string;
  price: number;
  image: string;
  capacity: number;
  amenities: string[];
  description: string;
  images: string[];
}

export const rooms: Room[] = [
  {
    id: "R1",
    name: "Deluxe King Room",
    type: "Master Suite",
    price: 1200000,
    image: room1,
    capacity: 2,
    amenities: ["King Bed", "En-suite Bathroom", "Balcony", "AC", "WiFi", "Minibar"],
    description: "Kamar tidur utama yang luas dengan tempat tidur King-size dan balkon pribadi dengan pemandangan langsung ke kolam renang.",
    images: [room1, room2],
  },
  {
    id: "R2",
    name: "Ocean View Suite",
    type: "Suite",
    price: 1500000,
    image: room2,
    capacity: 2,
    amenities: ["King Bed", "Ocean View", "Smart TV", "AC", "WiFi", "Bathtub"],
    description: "Nikmati pemandangan matahari terbenam yang indah langsung dari tempat tidur Anda di kamar Suite eksklusif ini.",
    images: [room2, room1],
  },
  {
    id: "R3",
    name: "Garden Twin Room",
    type: "Standard",
    price: 900000,
    image: room3,
    capacity: 2,
    amenities: ["Twin Beds", "Garden Access", "AC", "WiFi", "Desk"],
    description: "Kamar yang nyaman dengan akses langsung ke taman villa, cocok untuk teman atau anggota keluarga.",
    images: [room3, room4],
  },
  {
    id: "R4",
    name: "Family Suite",
    type: "Family",
    price: 2000000,
    image: room4,
    capacity: 4,
    amenities: ["2 Queen Beds", "Large Living Area", "Kitchenette", "AC", "WiFi"],
    description: "Kamar keluarga yang luas dengan fasilitas lengkap untuk kenyamanan bersama orang tercinta.",
    images: [room4, room3],
  },
];

export interface Booking {
  id: string;
  roomId: string;
  roomName: string;
  roomImage: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPrice: number;
  status: "confirmed" | "pending" | "pending_verification" | "completed" | "cancelled";
}
