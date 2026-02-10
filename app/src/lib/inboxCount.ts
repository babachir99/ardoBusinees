import { prisma } from "@/lib/prisma";

export async function getInboxUnreadCount(userId: string): Promise<number> {
  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  const inquiryWhere = {
    OR: [
      { buyerId: userId },
      ...(sellerProfile ? [{ sellerId: sellerProfile.id }] : []),
    ],
  };

  const inquiryDigest = await prisma.productInquiry.findMany({
    where: inquiryWhere,
    select: {
      buyerId: true,
      buyerLastReadAt: true,
      sellerLastReadAt: true,
      seller: { select: { userId: true } },
      messages: {
        select: { senderId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return inquiryDigest.reduce((count, inquiry) => {
    const lastMessage = inquiry.messages[0];
    if (!lastMessage) return count;
    if (lastMessage.senderId === userId) return count;

    const isBuyer = inquiry.buyerId === userId;
    const isSeller = inquiry.seller?.userId === userId;
    const lastReadAt = isBuyer
      ? inquiry.buyerLastReadAt
      : isSeller
      ? inquiry.sellerLastReadAt
      : null;

    const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;
    const lastMessageTime = new Date(lastMessage.createdAt).getTime();
    return lastMessageTime > lastReadTime ? count + 1 : count;
  }, 0);
}
