import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import { Button } from "antd";

export const RouteErrorBoundary = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  let title = "Something went wrong";
  let message = "Please try again.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message = typeof error.data === "string" ? error.data : "Route loading failed.";
  }

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-red-100 bg-white/80 p-6">
      <h2 className="text-xl font-semibold text-red-700">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <Button className="mt-4" onClick={() => navigate(0)}>
        Retry
      </Button>
    </div>
  );
};
