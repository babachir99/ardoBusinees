import { prisma } from "./src/lib/prisma.ts";

const users = await prisma.user.findMany({
  take: 3,
  select: { id: true, email: true, name: true, role: true },
  orderBy: { createdAt: "desc" },
});
console.log(JSON.stringify(users, null, 2));
await prisma.$disconnect();
