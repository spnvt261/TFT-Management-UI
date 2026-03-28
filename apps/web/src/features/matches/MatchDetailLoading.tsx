import { Card, Skeleton } from "antd";

export const MatchDetailLoading = ({ compact = false }: { compact?: boolean }) => (
  <div className="space-y-4">
    <Card>
      <Skeleton active title={{ width: "32%" }} paragraph={{ rows: 2 }} />
    </Card>

    <Card>
      <Skeleton active title={{ width: "40%" }} paragraph={{ rows: compact ? 4 : 6 }} />
    </Card>

    <Card>
      <Skeleton active title={{ width: "36%" }} paragraph={{ rows: compact ? 6 : 8 }} />
    </Card>
  </div>
);
