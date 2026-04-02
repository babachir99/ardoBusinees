import { prisma } from "./src/lib/prisma.ts";

const bookings = await prisma.gpTripBooking.findMany({
  take: 10,
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    status: true,
    requestedKg: true,
    createdAt: true,
    customer: { select: { id: true, email: true, name: true, role: true } },
    transporter: { select: { id: true, email: true, name: true, role: true } },
    trip: { select: { id: true, originCity: true, destinationCity: true } },
  },
});
console.log(JSON.stringify(bookings, null, 2));
await prisma.$disconnect();
