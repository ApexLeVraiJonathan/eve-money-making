import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { toast } from 'sonner';

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock API client
vi.mock('@/app/api-hooks/useApiClient', () => ({
  useApiClient: () => ({
    post: vi.fn(),
  }),
}));

describe('FeedbackDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders trigger button', () => {
    render(<FeedbackDialog />);
    expect(screen.getByText('Feedback')).toBeInTheDocument();
  });

  it('opens dialog when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    
    await user.click(screen.getByText('Feedback'));
    
    expect(screen.getByText('Share Your Feedback')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Help us improve by sharing your thoughts, suggestions, or reporting issues.',
      ),
    ).toBeInTheDocument();
  });

  it('renders all form fields', async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    
    await user.click(screen.getByText('Feedback'));
    
    expect(screen.getByLabelText(/Type/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Subject/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Message/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Overall Rating/)).toBeInTheDocument();
  });

  it('shows validation error when submitting empty form', async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    
    await user.click(screen.getByText('Feedback'));
    await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Please fill in all required fields',
      );
    });
  });

  it('shows character count for subject field', async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    
    await user.click(screen.getByText('Feedback'));
    
    const subjectInput = screen.getByLabelText(/Subject/);
    await user.type(subjectInput, 'Test feedback');
    
    expect(screen.getByText('13/200 characters')).toBeInTheDocument();
  });

  it('shows character count for message field', async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    
    await user.click(screen.getByText('Feedback'));
    
    const messageInput = screen.getByLabelText(/Message/);
    await user.type(messageInput, 'Test message');
    
    expect(screen.getByText('12/2000 characters')).toBeInTheDocument();
  });

  it('validates subject max length', async () => {
    const user = userEvent.setup();
    const { useApiClient } = await import('@/app/api-hooks/useApiClient');
    const mockPost = vi.fn();
    vi.mocked(useApiClient).mockReturnValue({ post: mockPost } as any);
    
    render(<FeedbackDialog />);
    await user.click(screen.getByText('Feedback'));
    
    // Fill form with subject that's too long
    const typeSelect = screen.getAllByRole('combobox')[0];
    await user.click(typeSelect);
    await user.click(screen.getByText('Bug Report'));
    
    const subjectInput = screen.getByLabelText(/Subject/);
    await user.type(subjectInput, 'a'.repeat(201));
    
    const messageInput = screen.getByLabelText(/Message/);
    await user.type(messageInput, 'Test message');
    
    await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Subject must be 200 characters or less',
      );
    });
    
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('validates message max length', async () => {
    const user = userEvent.setup();
    const { useApiClient } = await import('@/app/api-hooks/useApiClient');
    const mockPost = vi.fn();
    vi.mocked(useApiClient).mockReturnValue({ post: mockPost } as any);
    
    render(<FeedbackDialog />);
    await user.click(screen.getByText('Feedback'));
    
    // Fill form with message that's too long
    const typeSelect = screen.getAllByRole('combobox')[0];
    await user.click(typeSelect);
    await user.click(screen.getByText('Bug Report'));
    
    const subjectInput = screen.getByLabelText(/Subject/);
    await user.type(subjectInput, 'Test subject');
    
    const messageInput = screen.getByLabelText(/Message/);
    await user.type(messageInput, 'a'.repeat(2001));
    
    await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Message must be 2000 characters or less',
      );
    });
    
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('submits form successfully with valid data', async () => {
    const user = userEvent.setup();
    const { useApiClient } = await import('@/app/api-hooks/useApiClient');
    const mockPost = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(useApiClient).mockReturnValue({ post: mockPost } as any);
    
    render(<FeedbackDialog />);
    await user.click(screen.getByText('Feedback'));
    
    // Fill form
    const typeSelect = screen.getAllByRole('combobox')[0];
    await user.click(typeSelect);
    await user.click(screen.getByText('Feature Request'));
    
    const subjectInput = screen.getByLabelText(/Subject/);
    await user.type(subjectInput, 'Test subject');
    
    const messageInput = screen.getByLabelText(/Message/);
    await user.type(messageInput, 'Test message');
    
    await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));
    
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/feedback', {
        feedbackType: 'feature',
        subject: 'Test subject',
        message: 'Test message',
        rating: undefined,
      });
    });
    
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Thank you for your feedback!');
    });
  });

  it('submits form with optional rating', async () => {
    const user = userEvent.setup();
    const { useApiClient } = await import('@/app/api-hooks/useApiClient');
    const mockPost = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(useApiClient).mockReturnValue({ post: mockPost } as any);
    
    render(<FeedbackDialog />);
    await user.click(screen.getByText('Feedback'));
    
    // Fill form including rating
    const typeSelect = screen.getAllByRole('combobox')[0];
    await user.click(typeSelect);
    await user.click(screen.getByText('General Feedback'));
    
    const subjectInput = screen.getByLabelText(/Subject/);
    await user.type(subjectInput, 'Great app!');
    
    const messageInput = screen.getByLabelText(/Message/);
    await user.type(messageInput, 'I love this application');
    
    // Select rating
    const ratingSelect = screen.getAllByRole('combobox')[1];
    await user.click(ratingSelect);
    await user.click(screen.getByText(/⭐⭐⭐⭐⭐ Excellent/));
    
    await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));
    
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/feedback', {
        feedbackType: 'general',
        subject: 'Great app!',
        message: 'I love this application',
        rating: 5,
      });
    });
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    const { useApiClient } = await import('@/app/api-hooks/useApiClient');
    const mockPost = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));
    vi.mocked(useApiClient).mockReturnValue({ post: mockPost } as any);
    
    render(<FeedbackDialog />);
    await user.click(screen.getByText('Feedback'));
    
    // Fill form
    const typeSelect = screen.getAllByRole('combobox')[0];
    await user.click(typeSelect);
    await user.click(screen.getByText('Bug Report'));
    
    const subjectInput = screen.getByLabelText(/Subject/);
    await user.type(subjectInput, 'Test subject');
    
    const messageInput = screen.getByLabelText(/Message/);
    await user.type(messageInput, 'Test message');
    
    await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Network error');
    });
  });

  it('disables submit button while loading', async () => {
    const user = userEvent.setup();
    const { useApiClient } = await import('@/app/api-hooks/useApiClient');
    const mockPost = vi
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
    vi.mocked(useApiClient).mockReturnValue({ post: mockPost } as any);
    
    render(<FeedbackDialog />);
    await user.click(screen.getByText('Feedback'));
    
    // Fill form
    const typeSelect = screen.getAllByRole('combobox')[0];
    await user.click(typeSelect);
    await user.click(screen.getByText('Bug Report'));
    
    const subjectInput = screen.getByLabelText(/Subject/);
    await user.type(subjectInput, 'Test');
    
    const messageInput = screen.getByLabelText(/Message/);
    await user.type(messageInput, 'Test');
    
    const submitButton = screen.getByRole('button', { name: /Submit Feedback/i });
    await user.click(submitButton);
    
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Submitting...')).toBeInTheDocument();
  });

  it('resets form after successful submission', async () => {
    const user = userEvent.setup();
    const { useApiClient } = await import('@/app/api-hooks/useApiClient');
    const mockPost = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(useApiClient).mockReturnValue({ post: mockPost } as any);
    
    render(<FeedbackDialog />);
    await user.click(screen.getByText('Feedback'));
    
    // Fill form
    const typeSelect = screen.getAllByRole('combobox')[0];
    await user.click(typeSelect);
    await user.click(screen.getByText('Bug Report'));
    
    const subjectInput = screen.getByLabelText(/Subject/);
    await user.type(subjectInput, 'Test subject');
    
    const messageInput = screen.getByLabelText(/Message/);
    await user.type(messageInput, 'Test message');
    
    await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));
    
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
    
    // Dialog should close, so the form elements should not be visible
    await waitFor(() => {
      expect(screen.queryByLabelText(/Subject/)).not.toBeInTheDocument();
    });
  });

  it('handles all feedback types', async () => {
    const user = userEvent.setup();
    const { useApiClient } = await import('@/app/api-hooks/useApiClient');
    const mockPost = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(useApiClient).mockReturnValue({ post: mockPost } as any);
    
    const feedbackTypes = [
      'Bug Report',
      'Feature Request',
      'Improvement Suggestion',
      'General Feedback',
      'Other',
    ];
    
    for (const type of feedbackTypes) {
      render(<FeedbackDialog />);
      await user.click(screen.getByText('Feedback'));
      
      const typeSelect = screen.getAllByRole('combobox')[0];
      await user.click(typeSelect);
      await user.click(screen.getByText(type));
      
      const subjectInput = screen.getByLabelText(/Subject/);
      await user.type(subjectInput, `Test ${type}`);
      
      const messageInput = screen.getByLabelText(/Message/);
      await user.type(messageInput, 'Test message');
      
      await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));
      
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalled();
      });
      
      mockPost.mockClear();
    }
  });
});

