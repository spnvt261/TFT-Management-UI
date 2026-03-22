export interface AppError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}
