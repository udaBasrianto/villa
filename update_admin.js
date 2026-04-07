import fs from 'fs';

let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf-8');

code = code.replace(
  `  Save,\n  Image as ImageIcon\n} from "lucide-react";`,
  `  Save,\n  Image as ImageIcon,\n  List\n} from "lucide-react";\nimport {\n  Table,\n  TableBody,\n  TableCell,\n  TableHead,\n  TableHeader,\n  TableRow,\n} from "@/components/ui/table";`
);

code = code.replace(
  `<Tabs defaultValue="bookings" className="flex min-h-screen">`,
  `<Tabs defaultValue="dashboard" className="flex min-h-screen">`
);

code = code.replace(
  `<TabsTrigger value="bookings" className="justify-start rounded-xl px-3 py-2.5 gap-2 data-[state=active]:bg-slate-50 data-[state=active]:shadow-none">\n                <CalendarCheck className="w-4 h-4" /> Tasks\n              </TabsTrigger>`,
  `<TabsTrigger value="dashboard" className="justify-start rounded-xl px-3 py-2.5 gap-2 data-[state=active]:bg-slate-50 data-[state=active]:shadow-none">\n                <LayoutDashboard className="w-4 h-4" /> Dashboard\n              </TabsTrigger>\n              <TabsTrigger value="booking-list" className="justify-start rounded-xl px-3 py-2.5 gap-2 data-[state=active]:bg-slate-50 data-[state=active]:shadow-none">\n                <List className="w-4 h-4" /> Daftar Booking\n              </TabsTrigger>`
);

code = code.replace(
  `<TabsList className="w-full grid grid-cols-4 bg-white border h-12 rounded-2xl p-1 shadow-sm">\n                <TabsTrigger value="bookings" className="rounded-xl gap-2">\n                  <CalendarCheck className="w-4 h-4" />\n                </TabsTrigger>`,
  `<TabsList className="w-full grid grid-cols-5 bg-white border h-12 rounded-2xl p-1 shadow-sm">\n                <TabsTrigger value="dashboard" className="rounded-xl gap-2">\n                  <LayoutDashboard className="w-4 h-4" />\n                </TabsTrigger>\n                <TabsTrigger value="booking-list" className="rounded-xl gap-2">\n                  <List className="w-4 h-4" />\n                </TabsTrigger>`
);

code = code.replace(
  `<TabsContent value="bookings" className="mt-6">`,
  `<TabsContent value="dashboard" className="mt-6">`
);

const listRegex = /<div className="mt-6 space-y-4">[\s\S]*?<\/TabsContent>/;
const replacement = `</TabsContent>

            <TabsContent value="booking-list" className="mt-6">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Daftar Booking</h2>
                    <p className="text-sm text-slate-500 mt-1">Kelola semua data pemesanan dalam bentuk tabel rekap.</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Villa & Tamu</TableHead>
                      <TableHead>Check-in / Out</TableHead>
                      <TableHead>Total Harga</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell>
                          <div className="font-bold text-slate-900">{booking.villa_name}</div>
                          <div className="font-medium text-slate-700 mt-1">{booking.guest_name}</div>
                          <div className="text-xs text-slate-500">{booking.guest_email}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1"><Wallet className="w-3 h-3"/> {booking.payment_method}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{format(new Date(booking.check_in), "dd MMM yy", { locale: idLocale })} - {format(new Date(booking.check_out), "dd MMM yy", { locale: idLocale })}</div>
                          <div className="text-xs text-slate-500 mt-1">{booking.guests} Dewasa {booking.children > 0 ? \`, \${booking.children} Anak\` : ""}</div>
                        </TableCell>
                        <TableCell className="font-black text-slate-900">
                          {formatPrice(booking.total_price)}
                        </TableCell>
                        <TableCell>
                          <span className={\`text-[10px] font-bold px-2 py-1 rounded-full uppercase \${statusColors[booking.status]}\`}>
                            {booking.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {booking.status === "pending" && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 h-8 gap-1 rounded-xl"
                                onClick={() => updateStatus(booking.id, "confirmed")}
                              >
                                <CheckCircle2 className="w-3 h-3" /> Konfirm
                              </Button>
                            )}
                            {booking.status !== "cancelled" && booking.status !== "completed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50 h-8 gap-1 rounded-xl"
                                onClick={() => updateStatus(booking.id, "cancelled")}
                              >
                                <XCircle className="w-3 h-3" /> Batal
                              </Button>
                            )}
                            {booking.status === "confirmed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-blue-200 text-blue-600 hover:bg-blue-50 h-8 gap-1 rounded-xl"
                                onClick={() => updateStatus(booking.id, "completed")}
                              >
                                <CheckCircle2 className="w-3 h-3" /> Selesai
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {bookings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-slate-500">Belum ada booking.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>`;

code = code.replace(listRegex, replacement);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
console.log("Done");
