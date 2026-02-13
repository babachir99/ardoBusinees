import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PRODUCT_DELETE_CONFLICT_MESSAGE =
  "Cannot delete product with linked orders. Deactivate it instead.";

type DeleteProductResult =
  | { ok: true }
  | { ok: false; reason: "HAS_ORDERS" | "HAS_LINKED_DATA" };

export async function deleteProductSafely(
  productId: string
): Promise<DeleteProductResult> {
  const orderItemsCount = await prisma.orderItem.count({
    where: { productId },
  });

  if (orderItemsCount > 0) {
    return { ok: false, reason: "HAS_ORDERS" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId } });
      await tx.productCategory.deleteMany({ where: { productId } });
      await tx.productInquiryMessage.deleteMany({
        where: { inquiry: { productId } },
      });
      await tx.productOffer.deleteMany({ where: { productId } });
      await tx.productInquiry.deleteMany({ where: { productId } });
      await tx.productReview.deleteMany({ where: { productId } });
      await tx.favorite.deleteMany({ where: { productId } });
      await tx.userCartItem.deleteMany({ where: { productId } });
      await tx.product.delete({ where: { id: productId } });
    });

    return { ok: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return { ok: false, reason: "HAS_LINKED_DATA" };
    }

    throw error;
  }
}
