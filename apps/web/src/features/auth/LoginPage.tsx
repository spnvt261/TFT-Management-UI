import { useMemo, useState } from "react";
import { Button, Card, Input, Typography } from "antd";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FormApiError } from "@/components/common/FormApiError";
import { useAuth } from "@/features/auth/AuthContext";
import { toAppError } from "@/api/httpClient";
import { getErrorMessage } from "@/lib/error-messages";

const isSafeInternalPath = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }

  return value.startsWith("/") && !value.startsWith("//");
};

export const LoginPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, login } = useAuth();

  const [accessCode, setAccessCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const redirectTarget = useMemo(() => {
    const stateFrom = (location.state as { from?: unknown } | null)?.from;
    if (isSafeInternalPath(stateFrom)) {
      return stateFrom;
    }

    const queryFrom = searchParams.get("from");
    if (isSafeInternalPath(queryFrom)) {
      return queryFrom;
    }

    return "/match-stakes";
  }, [location.state, searchParams]);

  if (isAuthenticated) {
    return <Navigate to={redirectTarget} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <div className="mb-6 space-y-1">
          <Typography.Text className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">TFT2</Typography.Text>
          <Typography.Title level={3} className="!mb-0">
            Login
          </Typography.Title>
          <Typography.Text type="secondary">Enter your access code to continue.</Typography.Text>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!accessCode.trim() || isSubmitting) {
              return;
            }

            setIsSubmitting(true);
            setFormError(null);
            try {
              await login(accessCode);
              navigate(redirectTarget, { replace: true });
            } catch (error) {
              setFormError(getErrorMessage(toAppError(error)));
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          <FormApiError message={formError} />

          <div>
            <label className="mb-1 block text-sm font-medium">Access code</label>
            <Input
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="Enter access code"
              size="large"
              autoFocus
            />
          </div>

          <Button type="primary" htmlType="submit" size="large" block loading={isSubmitting} disabled={!accessCode.trim()}>
            Login
          </Button>
        </form>
      </Card>
    </div>
  );
};
