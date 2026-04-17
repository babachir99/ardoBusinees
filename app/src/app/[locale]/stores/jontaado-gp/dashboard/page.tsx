import TransporterDashboardPage, {
  generateMetadata as generateTransporterDashboardMetadata,
} from "@/app/[locale]/transporter/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(props: Parameters<typeof generateTransporterDashboardMetadata>[0]) {
  return generateTransporterDashboardMetadata(props);
}

export default TransporterDashboardPage;
