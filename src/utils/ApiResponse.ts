export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export class ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  pagination?: PaginationMeta;
  timestamp: string;

  constructor(
    success: boolean,
    statusCode: number,
    message: string,
    data: T | null,
    pagination?: PaginationMeta,
  ) {
    this.success = success;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.pagination = pagination;
    this.timestamp = new Date().toISOString();
  }

  static success<T>(
    data: T,
    message = "Request successful",
    statusCode = 200,
    pagination?: PaginationMeta,
  ): ApiResponse<T> {
    return new ApiResponse<T>(true, statusCode, message, data, pagination);
  }

  static error(message: string, statusCode = 400): ApiResponse<null> {
    return new ApiResponse<null>(false, statusCode, message, null);
  }
}
