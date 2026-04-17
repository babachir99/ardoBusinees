import GpShipmentsPage, {
  generateMetadata as generateGpShipmentsMetadata,
} from "@/app/[locale]/gp/shipments/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(props: Parameters<typeof generateGpShipmentsMetadata>[0]) {
  return generateGpShipmentsMetadata(props);
}

export default GpShipmentsPage;
