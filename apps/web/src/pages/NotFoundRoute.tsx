import { Button } from "antd";
import { useNavigate } from "react-router-dom";

export default function NotFoundRoute() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white/80 p-6 text-center">
      <h2 className="text-2xl font-bold text-slate-900">Page not found</h2>
      <p className="mt-2 text-sm text-slate-600">The route does not exist.</p>
      <Button type="primary" className="mt-4" onClick={() => navigate("/dashboard")}>
        Back to dashboard
      </Button>
    </div>
  );
}
