import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupportDialog } from '@/components/support-dialog';
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

describe('SupportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders trigger button', () => {
    render(<SupportDialog />);
    expect(screen.getByText('Support')).toBeInTheDocument();
  });

  it('opens dialog when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(<SupportDialog />);
    
    await user.click(screen.getByText('Support'));
    
    expect(screen.getByText('Contact Support')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Submit a support request and our team will get back to you shortly.',
      ),
    ).toBeInTheDocument();
  });

  it('renders all form fields', async () => {
    const user = userEvent.setup();
    render(<SupportDialog />);
    
    await user.click(screen.getByText('Support'));
    
    expect(screen.getByLabelText(/Category/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Subject/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Include technical context/),
    ).toBeInTheDocument();
  });

  it('shows validation error when submitting empty form', async () => {
    const user = userEvent.setup();
    render(<SupportDialog />);
    
    await user.click(screen.getByText('Support'));
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Please fill in all required fields',
      );
    });
  });

  it('shows character count for subject field', async () => {
    const user = userEvent.setup();
    render(<SupportDialog />);
    
    await user.click(screen.getByText('Support'));
    
    const subjectInput = screen.getByLabelText(/Subject/);
    await user.type(subjectInput, 'Test subject');
    
    expect(screen.getByText('12/200 characters')).toBeInTheDocument();
  });

  it('shows character count for description field', async () => {
    const user = userEvent.setup();
    render(<SupportDialog />);
    
    await user.click(screen.getByText('Support'));
    
    const descriptionInput = screen.getByLabelText(/Description/);
    await user.type(descriptionInput, 'Test description');
    
    expect(screen.getByText('16/2000 characters')).toBeInTheDocument();
  });

  it('validates subject max length', async () => {
    const user = userEvent.setup();
    const { useApiClient } = await import('@/app/api-hooks/useApiClient');
    const mockPost = vi.fn();
    vi.mocked(useApiClient).mockReturnValue({ post: mockPost } as any);
    
    render(<SupportDialog />);
    await user.click(screen.getByText('Support'));
    
    // Fill form with subject that's too long
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Technical Issue'));
    
    const subjectInput = screen.getByLabelText(/Subject/);
    await user.type(subjectInput, 'a'.repeat(201));
    
    const descriptionInput = screen.getByLabelText(/Description/);
    await user.type(descriptionInput, 'Test description');
    
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Subject must be 200 characters or less',
      );
    });
    
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('validates description max length', async () => {
    const user = userEvent.setup();
    const { useApiClient } = await import('@/app/api-hooks/useApiClient');
    const mockPost = vi.fn();
    vi.mocked(useApiClient).mockReturnValue({ post: mockPost } as any);
    
    render(<SupportDialog />);
    await user.click(screen.getByText('Support'));
    
    // Fill form with description that's too long
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Technical Issue'));
    
    const subjectInput = screen.getByLabelText(/Subject/);
    await user.type(subjectInput, 'Test subject');
    
    const descriptionInput = screen.getByLabelText(/Description/);
    await user.type(descriptionInput, 'a'.repeat(2001));
    
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Description must be 2000 characters or less',
      );
    });
    
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('submits form successfully with valid data', async () => {
    const user = userEvent.setup();
    const { useApiClient } = await import('@/app/api-hooks/useApiClient');
    const mockPost = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(useApiClient).mockReturnValue({ post: mockPost } as any);
    
    render(<SupportDialog />);
    await user.click(screen.getByText('Support'));
    
    // Fill form
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Technical Issue'));
    
    const subjectInput = screen.getByLabelText(/Subject/);
    await user.type(subjectInput, 'Test subject');
    
    const descriptionInput = screen.getByLabelText(/Description/);
    await user.type(descriptionInput, 'Test description');
    
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));
    
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/support', {
        category: 'technical',
        subject: 'Test subject',
        description: 'Test description',
        context: expect.any(Object),
      });
    });
    
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Support request submitted successfully',
      );
    });
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    const { useApiClient } = await import('@/app/api-hooks/useApiClient');
    const mockPost = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));
    vi.mocked(useApiClient).mockReturnValue({ post: mockPost } as any);
    
    render(<SupportDialog />);
    await user.click(screen.getByText('Support'));
    
    // Fill form
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Technical Issue'));
    
    const subjectInput = screen.getByLabelText(/Subject/);
    await user.type(subjectInput, 'Test subject');
    
    const descriptionInput = screen.getByLabelText(/Description/);
    await user.type(descriptionInput, 'Test description');
    
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));
    
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
    
    render(<SupportDialog />);
    await user.click(screen.getByText('Support'));
    
    // Fill form
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Technical Issue'));
    
    const subjectInput = screen.getByLabelText(/Subject/);
    await user.type(subjectInput, 'Test');
    
    const descriptionInput = screen.getByLabelText(/Description/);
    await user.type(descriptionInput, 'Test');
    
    const submitButton = screen.getByRole('button', { name: /Submit Request/i });
    await user.click(submitButton);
    
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Submitting...')).toBeInTheDocument();
  });

  it('resets form after successful submission', async () => {
    const user = userEvent.setup();
    const { useApiClient } = await import('@/app/api-hooks/useApiClient');
    const mockPost = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(useApiClient).mockReturnValue({ post: mockPost } as any);
    
    render(<SupportDialog />);
    await user.click(screen.getByText('Support'));
    
    // Fill form
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Technical Issue'));
    
    const subjectInput = screen.getByLabelText(/Subject/) as HTMLInputElement;
    await user.type(subjectInput, 'Test subject');
    
    const descriptionInput = screen.getByLabelText(/Description/) as HTMLTextAreaElement;
    await user.type(descriptionInput, 'Test description');
    
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));
    
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
    
    // Dialog should close, so the form elements should not be visible
    await waitFor(() => {
      expect(screen.queryByLabelText(/Subject/)).not.toBeInTheDocument();
    });
  });
});

