import RouteLoadingShell from "@/components/layout/RouteLoadingShell";

export default function AdminLoading() {
  return (
    <RouteLoadingShell
      title="Admin"
      subtitle="Chargement du tableau de bord admin et des indicateurs critiques..."
      showGrid={false}
    />
  );
}
