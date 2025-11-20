/**
 * @eve/api-contracts - OpenAPI/Zod contracts
 * 
 * (Future) This package will contain OpenAPI/Zod contracts and generated
 * TypeScript types shared between frontend and backend.
 * 
 * This will be populated during Phase 2 when Swagger is implemented.
 */

// Support & Feedback contracts

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

