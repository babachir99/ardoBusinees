import { prisma } from "./src/lib/prisma.ts";

const shipments = await prisma.gpShipment.findMany({
  take: 10,
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    code: true,
    status: true,
    createdAt: true,
    fromCity: true,
    toCity: true,
    sender: { select: { email: true, name: true } },
    receiver: { select: { email: true, name: true } },
    transporter: { select: { email: true, name: true } },
    booking: { select: { id: true } },
  },
});
console.log(JSON.stringify(shipments, null, 2));
await prisma.$disconnect();
