export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  message: string;
  statusCode: number;
  error?: string;
}
