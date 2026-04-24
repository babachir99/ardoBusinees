import AppHeader from "@/components/layout/AppHeader";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <>
      <AppHeader locale={locale} />
      <div className="pt-[92px] sm:pt-[100px]">{children}</div>
    </>
  );
}
