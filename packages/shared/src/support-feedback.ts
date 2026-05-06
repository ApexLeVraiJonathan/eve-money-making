export interface CreateSupportRequest {
  category: string;
  subject: string;
  description: string;
  context?: {
    url?: string;
    userAgent?: string;
  };
}

export interface CreateFeedbackRequest {
  feedbackType: string;
  subject: string;
  message: string;
  rating?: number;
}

export interface SupportFeedbackResponse {
  success: boolean;
  message?: string;
}
