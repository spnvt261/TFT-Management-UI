import { useState } from "react";
import { Button, Card, DatePicker, Drawer, Input, InputNumber, List, Pagination, Select, Tabs, Tag, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCreateGroupFundTransaction,
  useGroupFundLedger,
  useGroupFundMatches,
  useGroupFundSummary,
  useGroupFundTransactions
} from "@/features/group-fund/hooks";
import { useActivePlayers } from "@/features/players/hooks";
import { PageLoading } from "@/components/states/PageLoading";
import { ErrorState } from "@/components/states/ErrorState";
import { EmptyState } from "@/components/states/EmptyState";
import { MatchDetailOverlay } from "@/features/matches/MatchDetailOverlay";
import { QuickMatchEntry } from "@/features/quick-match/QuickMatchEntry";
import { formatDateTime, formatVnd, nowIso } from "@/lib/format";
import { groupFundTransactionLabels } from "@/lib/labels";
import { manualTransactionSchema, type ManualTransactionValues } from "@/features/group-fund/schemas";
import { FormApiError } from "@/components/common/FormApiError";
import { getErrorMessage } from "@/lib/error-messages";
import { toAppError } from "@/api/httpClient";

export const GroupFundPage = () => {
  const [selectedMatchId, setSelectedMatchId] = useState<string>();
  const [quickOpen, setQuickOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [from, setFrom] = useState<string>();
  const [to, setTo] = useState<string>();
  const [page, setPage] = useState(1);

  const summaryQuery = useGroupFundSummary({ from, to });
  const ledgerQuery = useGroupFundLedger({ from, to, page, pageSize: 12 });
  const matchesQuery = useGroupFundMatches({ from, to, page, pageSize: 12 });
  const transactionsQuery = useGroupFundTransactions({ from, to, page, pageSize: 12 });
  const playersQuery = useActivePlayers();

  const createTransactionMutation = useCreateGroupFundTransaction();
  const {
    control,
    watch,
    reset,
    handleSubmit,
    formState: { errors }
  } = useForm<ManualTransactionValues>({
    resolver: zodResolver(manualTransactionSchema),
    defaultValues: {
      transactionType: "CONTRIBUTION",
      playerId: "",
      amountVnd: 0,
      reason: "",
      postedAt: nowIso()
    }
  });

  const transactionType = watch("transactionType");

  const loading = summaryQuery.isLoading || ledgerQuery.isLoading || matchesQuery.isLoading || transactionsQuery.isLoading;
  const hasError = summaryQuery.isError || ledgerQuery.isError || matchesQuery.isError || transactionsQuery.isError;

  if (loading) {
    return <PageLoading label="Loading Group Fund..." />;
  }

  if (hasError) {
    return (
      <ErrorState
        onRetry={() => {
          void summaryQuery.refetch();
          void ledgerQuery.refetch();
          void matchesQuery.refetch();
          void transactionsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Group Fund</h2>
        <div className="hidden gap-2 md:flex">
          <Button onClick={() => setTransactionOpen(true)}>Manual transaction</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setQuickOpen(true)}>
            Quick add match
          </Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DatePicker
            className="w-full"
            placeholder="From date"
            value={from ? dayjs(from) : null}
            onChange={(value) => setFrom(value ? value.toISOString() : undefined)}
          />
          <DatePicker
            className="w-full"
            placeholder="To date"
            value={to ? dayjs(to) : null}
            onChange={(value) => setTo(value ? value.toISOString() : undefined)}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card>
          <div className="text-xs text-slate-500">Fund balance</div>
          <div className="text-2xl font-bold">{formatVnd(summaryQuery.data?.fundBalanceVnd ?? 0)}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Total matches</div>
          <div className="text-2xl font-bold">{summaryQuery.data?.totalMatches ?? 0}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Current obligations</div>
          <div className="text-sm text-slate-700">{(summaryQuery.data?.players ?? []).reduce((sum, player) => sum + player.currentObligationVnd, 0).toLocaleString("vi-VN")} ?</div>
        </Card>
      </div>

      <Card title="Per-player contribution / obligation">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(summaryQuery.data?.players ?? []).map((player) => (
            <div key={player.playerId} className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="font-medium">{player.playerName}</div>
              <div>Contributed: {formatVnd(player.totalContributedVnd)}</div>
              <div>Obligation: {formatVnd(player.currentObligationVnd)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Tabs
        items={[
          {
            key: "ledger",
            label: "Fund Ledger",
            children:
              (ledgerQuery.data?.data ?? []).length === 0 ? (
                <EmptyState title="No ledger entries" />
              ) : (
                <div className="space-y-3">
                  {(ledgerQuery.data?.data ?? []).map((entry) => (
                    <button
                      key={entry.entryId}
                      className="focus-ring w-full rounded-2xl border border-slate-200 p-3 text-left"
                      onClick={() => entry.matchId && setSelectedMatchId(entry.matchId)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-slate-500">{formatDateTime(entry.postedAt)}</div>
                        <Tag color={entry.movementType === "FUND_IN" ? "green" : "red"}>{entry.movementType}</Tag>
                      </div>
                      <div className="mt-1 text-sm font-medium">{entry.relatedPlayerName || "System"}</div>
                      <div className="text-sm">{formatVnd(entry.amountVnd)}</div>
                      <div className="mt-1 text-xs text-slate-500">{entry.entryReason}</div>
                    </button>
                  ))}
                  <div className="flex justify-center">
                    <Pagination
                      current={ledgerQuery.data?.meta?.page ?? page}
                      pageSize={ledgerQuery.data?.meta?.pageSize ?? 12}
                      total={ledgerQuery.data?.meta?.total ?? 0}
                      showSizeChanger={false}
                      onChange={setPage}
                    />
                  </div>
                </div>
              )
          },
          {
            key: "matches",
            label: "Match History",
            children:
              (matchesQuery.data?.data ?? []).length === 0 ? (
                <EmptyState title="No matches" />
              ) : (
                <List
                  dataSource={matchesQuery.data?.data ?? []}
                  renderItem={(item) => (
                    <List.Item className="!px-0">
                      <button
                        className="focus-ring w-full rounded-2xl border border-slate-200 p-3 text-left"
                        onClick={() => setSelectedMatchId(item.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{formatDateTime(item.playedAt)}</span>
                          <Tag>{`v${item.ruleSetVersionNo}`}</Tag>
                        </div>
                        <div className="text-xs text-slate-500">{item.ruleSetName}</div>
                        <div className="mt-1 text-xs">{item.participants.map((participant) => `${participant.playerName} #${participant.tftPlacement}`).join(" | ")}</div>
                        <div className="mt-1 text-xs text-slate-500">Fund in/out: {formatVnd(item.totalFundInVnd)} / {formatVnd(item.totalFundOutVnd)}</div>
                      </button>
                    </List.Item>
                  )}
                />
              )
          },
          {
            key: "transactions",
            label: "Manual Transactions",
            children:
              (transactionsQuery.data?.data ?? []).length === 0 ? (
                <EmptyState title="No manual transactions" actionLabel="Create transaction" onAction={() => setTransactionOpen(true)} />
              ) : (
                <div className="space-y-3">
                  <Button onClick={() => setTransactionOpen(true)}>Create manual transaction</Button>
                  {(transactionsQuery.data?.data ?? []).map((txn) => (
                    <div key={txn.entryId} className="rounded-2xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Tag>{groupFundTransactionLabels[txn.transactionType]}</Tag>
                        <span className="text-sm font-semibold">{formatVnd(txn.amountVnd)}</span>
                      </div>
                      <div className="mt-1 text-sm">{txn.playerName || "N/A"}</div>
                      <div className="mt-1 text-xs text-slate-500">{txn.reason}</div>
                    </div>
                  ))}
                </div>
              )
          }
        ]}
      />

      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<PlusOutlined />}
        className="fixed bottom-6 right-6 z-20 h-14 w-14 shadow-lg md:hidden"
        aria-label="Quick add group fund match"
        onClick={() => setQuickOpen(true)}
      />

      <QuickMatchEntry open={quickOpen} module="GROUP_FUND" onClose={() => setQuickOpen(false)} />
      <MatchDetailOverlay open={Boolean(selectedMatchId)} matchId={selectedMatchId} onClose={() => setSelectedMatchId(undefined)} />

      <Drawer
        title="Manual Group Fund Transaction"
        open={transactionOpen}
        onClose={() => setTransactionOpen(false)}
        width={460}
      >
        <form
          className="space-y-4"
          onSubmit={handleSubmit(async (values) => {
            setApiError(null);
            try {
              await createTransactionMutation.mutateAsync({
                transactionType: values.transactionType,
                playerId: values.playerId || null,
                amountVnd: values.amountVnd,
                reason: values.reason,
                postedAt: values.postedAt
              });
              message.success("Transaction created");
              reset({
                transactionType: "CONTRIBUTION",
                playerId: "",
                amountVnd: 0,
                reason: "",
                postedAt: nowIso()
              });
            } catch (error) {
              setApiError(getErrorMessage(toAppError(error)));
            }
          })}
        >
          <FormApiError message={apiError} />

          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <Controller
              control={control}
              name="transactionType"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onChange={field.onChange}
                  options={Object.entries(groupFundTransactionLabels).map(([value, label]) => ({ value, label }))}
                  size="large"
                />
              )}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Player</label>
            <Controller
              control={control}
              name="playerId"
              render={({ field }) => (
                <Select
                  allowClear
                  value={field.value || undefined}
                  onChange={(value) => field.onChange(value || "")}
                  disabled={!(transactionType === "CONTRIBUTION" || transactionType === "WITHDRAWAL")}
                  options={(playersQuery.data ?? []).map((player) => ({ value: player.id, label: player.displayName }))}
                  size="large"
                  status={errors.playerId ? "error" : ""}
                />
              )}
            />
            {errors.playerId ? <div className="mt-1 text-xs text-red-600">{errors.playerId.message}</div> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Amount (VND)</label>
            <Controller
              control={control}
              name="amountVnd"
              render={({ field }) => (
                <InputNumber
                  min={1}
                  precision={0}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? 0)}
                  className="w-full"
                  size="large"
                  status={errors.amountVnd ? "error" : ""}
                />
              )}
            />
            {errors.amountVnd ? <div className="mt-1 text-xs text-red-600">{errors.amountVnd.message}</div> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Reason</label>
            <Controller
              control={control}
              name="reason"
              render={({ field }) => <Input.TextArea {...field} rows={3} status={errors.reason ? "error" : ""} />}
            />
            {errors.reason ? <div className="mt-1 text-xs text-red-600">{errors.reason.message}</div> : null}
          </div>

          <Button type="primary" htmlType="submit" loading={createTransactionMutation.isPending}>
            Create transaction
          </Button>
        </form>
      </Drawer>
    </div>
  );
};
