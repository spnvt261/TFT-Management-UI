export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

export interface PaginatedResult<T> {
  data: T;
  meta?: PaginationMeta;
}

export type ModuleType = "MATCH_STAKES" | "GROUP_FUND";
export type MatchStatus = "DRAFT" | "CALCULATED" | "POSTED" | "VOIDED";
export type DebtPeriodStatus = "OPEN" | "CLOSED";
export type RuleStatus = "ACTIVE" | "INACTIVE";
export type RuleKind =
  | "BASE_RELATIVE_RANK"
  | "ABSOLUTE_PLACEMENT_MODIFIER"
  | "PAIR_CONDITION_MODIFIER"
  | "FUND_CONTRIBUTION"
  | "CUSTOM";
export type RuleBuilderType = "MATCH_STAKES_PAYOUT";

export type ConditionOperator =
  | "EQ"
  | "NEQ"
  | "GT"
  | "GTE"
  | "LT"
  | "LTE"
  | "IN"
  | "NOT_IN"
  | "BETWEEN"
  | "CONTAINS";

export type SelectorType =
  | "SUBJECT_PLAYER"
  | "PLAYER_BY_RELATIVE_RANK"
  | "PLAYER_BY_ABSOLUTE_PLACEMENT"
  | "MATCH_WINNER"
  | "MATCH_RUNNER_UP"
  | "BEST_PARTICIPANT"
  | "WORST_PARTICIPANT"
  | "FUND_ACCOUNT"
  | "SYSTEM_ACCOUNT"
  | "FIXED_PLAYER";

export type MatchStakesPenaltyDestinationSelectorType =
  | "BEST_PARTICIPANT"
  | "MATCH_WINNER"
  | "FIXED_PLAYER"
  | "FUND_ACCOUNT";

export interface PlayerDto {
  id: string;
  displayName: string;
  slug: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MatchParticipantDto {
  playerId: string;
  playerName: string;
  tftPlacement: number;
  relativeRank: number;
  isWinnerAmongParticipants?: boolean;
  settlementNetVnd: number;
}

export interface SettlementLineDto {
  id: string;
  lineNo: number;
  ruleId: string | null;
  ruleCode: string;
  ruleName: string;
  sourceAccountId: string;
  destinationAccountId: string;
  sourcePlayerId: string | null;
  sourcePlayerName: string | null;
  destinationPlayerId: string | null;
  destinationPlayerName: string | null;
  amountVnd: number;
  reasonText: string;
  metadata: unknown;
}

export interface SettlementDto {
  id: string;
  totalTransferVnd: number;
  totalFundInVnd: number;
  totalFundOutVnd: number;
  engineVersion: string;
  ruleSnapshot: unknown;
  resultSnapshot: unknown;
  postedToLedgerAt: string | null;
  lines: SettlementLineDto[];
}

export interface DashboardOverviewDto {
  playerCount: number;
  totalMatches: number;
  matchStakes: {
    totalMatches: number;
    topPlayers: Array<{
      playerId: string;
      playerName: string;
      totalNetVnd: number;
    }>;
  };
  groupFund: {
    totalMatches: number;
    fundBalanceVnd: number;
    topContributors: Array<{
      playerId: string;
      playerName: string;
      totalContributedVnd: number;
    }>;
  };
  recentMatches: MatchListItemDto[];
}

export interface ListPlayersQuery {
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreatePlayerRequest {
  displayName: string;
  slug?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
}

export interface UpdatePlayerRequest {
  displayName?: string;
  slug?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
}

export interface RuleSetDto {
  id: string;
  module: ModuleType;
  code: string;
  name: string;
  description: string | null;
  status: RuleStatus;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListRuleSetsQuery {
  module?: ModuleType;
  modules?: ModuleType[];
  status?: RuleStatus;
  isDefault?: boolean;
  default?: boolean;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateRuleSetRequest {
  module: ModuleType;
  name: string;
  status?: RuleStatus;
  isDefault?: boolean;
  description: string | null;
  participantCountMin: number;
  participantCountMax: number;
  effectiveTo?: string | null;
  isActive?: boolean;
  summaryJson?: Record<string, unknown> | null;
  builderType?: RuleBuilderType | null;
  builderConfig?: MatchStakesBuilderConfig | Record<string, unknown> | null;
  rules?: RuleInput[];
}

export interface UpdateRuleSetRequest {
  name?: string;
  status?: RuleStatus;
  isDefault?: boolean;
  description: string | null;
  participantCountMin: number;
  participantCountMax: number;
  effectiveTo?: string | null;
  isActive?: boolean;
  summaryJson?: Record<string, unknown> | null;
  builderType?: RuleBuilderType | null;
  builderConfig?: MatchStakesBuilderConfig | Record<string, unknown> | null;
  rules?: RuleInput[];
}

export interface RuleConditionDto {
  id?: string;
  conditionKey: string;
  operator: string;
  valueJson: unknown;
  sortOrder: number;
}

export interface RuleActionDto {
  id?: string;
  actionType: string;
  amountVnd: number;
  sourceSelectorType: string;
  sourceSelectorJson: unknown;
  destinationSelectorType: string;
  destinationSelectorJson: unknown;
  descriptionTemplate: string | null;
  sortOrder: number;
}

export interface RuleDto {
  id?: string;
  code: string;
  name: string;
  description: string | null;
  ruleKind: string;
  priority: number;
  status: string;
  stopProcessingOnMatch: boolean;
  metadata: unknown;
  conditions: RuleConditionDto[];
  actions: RuleActionDto[];
}

export interface RuleSetVersionDetailDto {
  id: string;
  ruleSetId: string;
  versionNo: number;
  description: string | null;
  participantCountMin: number;
  participantCountMax: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  summaryJson: unknown;
  builderType: string | null;
  builderConfig: unknown | null;
  createdAt: string;
  rules: RuleDto[];
}

export type RuleSetVersionListItemDto = RuleSetVersionDetailDto;

export interface RuleSetDetailDto extends RuleSetDto {
  latestVersion: RuleSetVersionDetailDto | null;
  versions: RuleSetVersionDetailDto[];
}

export type RuleConditionKey =
  | "participantCount"
  | "module"
  | "subjectRelativeRank"
  | "subjectAbsolutePlacement"
  | "matchContainsAbsolutePlacements";

export type RuleActionType = "TRANSFER" | "POST_TO_FUND" | "CREATE_OBLIGATION" | "REDUCE_OBLIGATION";

export interface RuleInput {
  code: string;
  name: string;
  description?: string | null;
  ruleKind: RuleKind;
  priority?: number;
  status?: RuleStatus;
  stopProcessingOnMatch?: boolean;
  metadata?: Record<string, unknown> | null;
  conditions: Array<{
    conditionKey: RuleConditionKey;
    operator: ConditionOperator;
    valueJson: unknown;
    sortOrder?: number;
  }>;
  actions: Array<{
    actionType: RuleActionType;
    amountVnd: number;
    sourceSelectorType: SelectorType;
    sourceSelectorJson?: unknown;
    destinationSelectorType: SelectorType;
    destinationSelectorJson?: unknown;
    descriptionTemplate?: string | null;
    sortOrder?: number;
  }>;
}

export interface MatchStakesPenaltyConfig {
  absolutePlacement: number;
  amountVnd: number;
  destinationSelectorType?: MatchStakesPenaltyDestinationSelectorType;
  destinationSelectorJson?: Record<string, unknown> | null;
  code?: string;
  name?: string;
  description?: string | null;
}

export interface MatchStakesBuilderConfig {
  participantCount: 3 | 4;
  winnerCount: number;
  payouts: Array<{ relativeRank: number; amountVnd: number }>;
  losses: Array<{ relativeRank: number; amountVnd: number }>;
  penalties?: MatchStakesPenaltyConfig[];
}

export interface CreateRuleSetVersionRequest {
  participantCountMin: number;
  participantCountMax: number;
  effectiveTo?: string | null;
  isActive?: boolean;
  summaryJson?: Record<string, unknown> | null;
  builderType?: RuleBuilderType | null;
  builderConfig?: MatchStakesBuilderConfig | null;
  rules?: RuleInput[];
}

export interface DefaultRuleSetByModuleDto {
  ruleSet: RuleSetDto;
  activeVersion: RuleSetVersionDetailDto | null;
}

export interface PreviewMatchRequest {
  module: ModuleType;
  ruleSetId: string;
  note?: string | null;
  participants: Array<{
    playerId: string;
    tftPlacement: number;
  }>;
}

export interface PreviewMatchParticipantDto {
  playerId: string;
  playerName: string;
  tftPlacement: number;
  relativeRank: number;
  suggestedNetVnd: number;
}

export interface PreviewSettlementLineDto {
  lineNo: number;
  ruleId: string | null;
  ruleCode: string;
  ruleName: string;
  sourceAccountId: string;
  destinationAccountId: string;
  sourcePlayerId: string | null;
  sourcePlayerName: string | null;
  destinationPlayerId: string | null;
  destinationPlayerName: string | null;
  amountVnd: number;
  reasonText: string;
  metadata: unknown;
}

export interface PreviewSettlementDto {
  totalTransferVnd: number;
  totalFundInVnd: number;
  totalFundOutVnd: number;
  engineVersion: string;
  ruleSnapshot: unknown;
  resultSnapshot: unknown;
  lines: PreviewSettlementLineDto[];
}

export interface PreviewMatchResultDto {
  module: ModuleType;
  note: string | null;
  ruleSet: { id: string; name: string; module: ModuleType };
  ruleSetVersion: {
    id: string;
    versionNo: number;
    participantCountMin: number;
    participantCountMax: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  };
  participants: PreviewMatchParticipantDto[];
  settlementPreview: PreviewSettlementDto;
}

export interface MatchConfirmationInput {
  mode: "ENGINE" | "MANUAL_ADJUSTED";
  participantNets?: Array<{
    playerId: string;
    netVnd: number;
  }>;
  overrideReason?: string | null;
}

export interface CreateMatchRequest {
  module: ModuleType;
  ruleSetId: string;
  ruleSetVersionId?: string;
  note?: string | null;
  participants: Array<{
    playerId: string;
    tftPlacement: number;
  }>;
  confirmation?: MatchConfirmationInput;
}

export interface MatchListQuery {
  module?: ModuleType;
  status?: MatchStatus;
  playerId?: string;
  ruleSetId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface MatchListItemDto {
  id: string;
  module: ModuleType;
  playedAt: string;
  participantCount: number;
  ruleSetId: string;
  ruleSetName: string;
  ruleSetVersionId: string;
  ruleSetVersionNo: number;
  notePreview: string | null;
  status: string;
  debtPeriodId?: string | null;
  debtPeriodNo?: number | null;
  confirmationMode?: "ENGINE" | "MANUAL_ADJUSTED";
  overrideReason?: string | null;
  manualAdjusted?: boolean;
  participants: MatchParticipantDto[];
  totalTransferVnd: number;
  totalFundInVnd: number;
  totalFundOutVnd: number;
  createdAt: string;
}

export interface MatchDetailDto {
  id: string;
  module: ModuleType;
  playedAt: string;
  participantCount: number;
  status: string;
  note: string | null;
  debtPeriodId?: string | null;
  debtPeriodNo?: number | null;
  confirmationMode?: "ENGINE" | "MANUAL_ADJUSTED";
  overrideReason?: string | null;
  manualAdjusted?: boolean;
  ruleSet: { id: string; name: string; module: ModuleType };
  ruleSetVersion: {
    id: string;
    versionNo: number;
    participantCountMin: number;
    participantCountMax: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  } | null;
  participants: MatchParticipantDto[];
  settlement: SettlementDto | null;
  voidReason?: string | null;
  voidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VoidMatchRequest {
  reason: string;
}

export interface VoidMatchResultDto {
  id: string;
  status: "VOIDED";
  reason: string;
  voidedAt: string;
}

export interface RecentPresetDto {
  module: ModuleType;
  lastRuleSetId: string | null;
  lastRuleSetVersionId: string | null;
  lastSelectedPlayerIds: string[];
  lastParticipantCount: number | null;
  lastUsedAt: string | null;
}

export interface UpsertPresetRequest {
  lastRuleSetId?: string | null;
  lastRuleSetVersionId?: string | null;
  lastSelectedPlayerIds?: string[];
  lastParticipantCount: number;
}

export interface ModuleSummaryQuery {
  from?: string;
  to?: string;
}

export interface ModuleLedgerQuery {
  playerId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface MatchStakesMatchesQuery extends ModuleLedgerQuery {
  ruleSetId?: string;
  periodId?: string;
}

export interface ListDebtPeriodsQuery {
  page?: number;
  pageSize?: number;
}

export interface DebtPeriodDto {
  id: string;
  periodNo: number;
  title: string | null;
  note: string | null;
  status: DebtPeriodStatus;
  openedAt: string;
  closedAt: string | null;
}

export interface DebtPeriodPlayerSummaryDto {
  playerId: string;
  playerName: string;
  totalMatches: number;
  accruedNetVnd: number;
  settledPaidVnd: number;
  settledReceivedVnd: number;
  outstandingNetVnd: number;
}

export interface DebtPeriodSummaryDto {
  totalMatches: number;
  totalPlayers: number;
  totalOutstandingReceiveVnd: number;
  totalOutstandingPayVnd: number;
}

export interface DebtPeriodCurrentDto {
  period: DebtPeriodDto;
  summary: DebtPeriodSummaryDto;
  players: DebtPeriodPlayerSummaryDto[];
}

export interface DebtSettlementLineDto {
  id: string;
  payerPlayerId: string;
  payerPlayerName: string;
  receiverPlayerId: string;
  receiverPlayerName: string;
  amountVnd: number;
  note: string | null;
  createdAt: string;
}

export interface DebtSettlementDto {
  id: string;
  postedAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  lines: DebtSettlementLineDto[];
}

export interface DebtPeriodDetailDto {
  period: DebtPeriodDto;
  summary: DebtPeriodSummaryDto;
  players: DebtPeriodPlayerSummaryDto[];
  settlements: DebtSettlementDto[];
  recentMatches: Array<{
    id: string;
    playedAt: string;
    participantCount: number;
    status: string;
    debtPeriodId: string | null;
    debtPeriodNo: number | null;
  }>;
}

export interface DebtPeriodListItemDto extends DebtPeriodDto {
  totalMatches: number;
  totalPlayers: number;
  totalOutstandingReceiveVnd: number;
  totalOutstandingPayVnd: number;
}

export interface CreateDebtPeriodRequest {
  title?: string | null;
  note?: string | null;
}

export interface CreateDebtSettlementLineRequest {
  payerPlayerId: string;
  receiverPlayerId: string;
  amountVnd: number;
  note?: string | null;
}

export interface CreateDebtSettlementRequest {
  postedAt?: string;
  note?: string | null;
  lines: CreateDebtSettlementLineRequest[];
}

export interface CreateDebtSettlementResultDto {
  settlement: DebtSettlementDto;
  summary: DebtPeriodSummaryDto;
  players: DebtPeriodPlayerSummaryDto[];
}

export interface CloseDebtPeriodRequest {
  note?: string | null;
}

export interface CloseDebtPeriodResultDto {
  id: string;
  status: "CLOSED";
  closedAt: string | null;
}

export interface MatchStakesSummaryDto {
  module: "MATCH_STAKES";
  players: Array<{
    playerId: string;
    playerName: string;
    totalNetVnd: number;
    totalMatches: number;
    firstPlaceCountAmongParticipants: number;
    biggestLossCount: number;
  }>;
  debtSuggestions: unknown[];
  totalMatches: number;
  range: { from: string | null; to: string | null };
}

export interface MatchStakesLedgerItemDto {
  entryId: string;
  postedAt: string;
  matchId: string | null;
  sourcePlayerId: string | null;
  sourcePlayerName: string | null;
  destinationPlayerId: string | null;
  destinationPlayerName: string | null;
  amountVnd: number;
  entryReason: string;
  ruleCode: string | null;
  ruleName: string | null;
}

export interface GroupFundSummaryDto {
  module: "GROUP_FUND";
  fundBalanceVnd: number;
  totalMatches: number;
  players: Array<{
    playerId: string;
    playerName: string;
    totalContributedVnd: number;
    currentObligationVnd: number;
  }>;
  range: { from: string | null; to: string | null };
}

export type GroupFundTransactionType = "CONTRIBUTION" | "WITHDRAWAL" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";

export interface GroupFundLedgerItemDto {
  entryId: string;
  postedAt: string;
  matchId: string | null;
  relatedPlayerId: string | null;
  relatedPlayerName: string | null;
  amountVnd: number;
  movementType: "FUND_IN" | "FUND_OUT";
  entryReason: string;
  ruleCode: string | null;
  ruleName: string | null;
}

export interface CreateGroupFundTransactionRequest {
  transactionType: GroupFundTransactionType;
  playerId?: string | null;
  amountVnd: number;
  reason: string;
  postedAt?: string;
}

export interface GroupFundTransactionDto {
  entryId: string;
  batchId: string;
  postedAt: string;
  sourceType: "MANUAL_ADJUSTMENT" | "SYSTEM_CORRECTION";
  transactionType: GroupFundTransactionType;
  playerId: string | null;
  playerName: string | null;
  amountVnd: number;
  reason: string;
}

export interface CreateGroupFundTransactionResultDto {
  batchId: string;
  postedAt: string;
  sourceType: "MANUAL_ADJUSTMENT" | "SYSTEM_CORRECTION";
  transactionType: GroupFundTransactionType;
  playerId: string | null;
  playerName: string | null;
  amountVnd: number;
  reason: string;
}

export interface GroupFundTransactionQuery {
  transactionType?: GroupFundTransactionType;
  playerId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
