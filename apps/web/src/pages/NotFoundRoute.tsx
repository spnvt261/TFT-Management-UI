import { Button } from "antd";
import { useNavigate } from "react-router-dom";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function NotFoundRoute() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <AppBreadcrumb items={[{ label: "Not Found" }]} />

      <PageHeader title="Page not found" subtitle="The route does not exist." />

      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white/80 p-6 text-center">
        <Button type="primary" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    </PageContainer>
  );
}
