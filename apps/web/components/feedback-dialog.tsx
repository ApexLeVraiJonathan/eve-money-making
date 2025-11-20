"use client";

import * as React from "react";
import { useState } from "react";
import { Send } from "lucide-react";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@eve/ui";
import { Button } from "@eve/ui";
import { Label } from "@eve/ui";
import { Input } from "@eve/ui";
import { Textarea } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import type { CreateFeedbackRequest } from "@eve/api-contracts";

const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "improvement", label: "Improvement Suggestion" },
  { value: "general", label: "General Feedback" },
  { value: "other", label: "Other" },
] as const;

interface FeedbackDialogProps {
  children?: React.ReactNode;
}

export function FeedbackDialog({ children }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedbackType, setFeedbackType] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | undefined>(undefined);

  const client = useApiClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedbackType || !subject.trim() || !message.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (subject.length > 200) {
      toast.error("Subject must be 200 characters or less");
      return;
    }

    if (message.length > 2000) {
      toast.error("Message must be 2000 characters or less");
      return;
    }

    setLoading(true);

    try {
      const payload: CreateFeedbackRequest = {
        feedbackType,
        subject: subject.trim(),
        message: message.trim(),
        rating,
      };

      await client.post("/feedback", payload);

      toast.success("Thank you for your feedback!");

      // Reset form and close dialog
      setFeedbackType("");
      setSubject("");
      setMessage("");
      setRating(undefined);
      setOpen(false);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to submit feedback",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFeedbackType("");
    setSubject("");
    setMessage("");
    setRating(undefined);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm">
            <Send className="h-4 w-4 mr-2" />
            Feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Share Your Feedback</DialogTitle>
            <DialogDescription>
              Help us improve by sharing your thoughts, suggestions, or
              reporting issues.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="feedbackType">
                Type <span className="text-destructive">*</span>
              </Label>
              <Select value={feedbackType} onValueChange={setFeedbackType}>
                <SelectTrigger id="feedbackType">
                  <SelectValue placeholder="Select feedback type" />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subject">
                Subject <span className="text-destructive">*</span>
              </Label>
              <Input
                id="subject"
                placeholder="Brief summary of your feedback"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                required
              />
              <p className="text-xs text-muted-foreground">
                {subject.length}/200 characters
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">
                Message <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="message"
                placeholder="Share your feedback in detail"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={6}
                required
              />
              <p className="text-xs text-muted-foreground">
                {message.length}/2000 characters
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rating">Overall Rating (Optional)</Label>
              <Select
                value={rating?.toString() ?? ""}
                onValueChange={(val) =>
                  setRating(val ? parseInt(val, 10) : undefined)
                }
              >
                <SelectTrigger id="rating">
                  <SelectValue placeholder="Rate your experience (1-5 stars)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">⭐⭐⭐⭐⭐ Excellent</SelectItem>
                  <SelectItem value="4">⭐⭐⭐⭐ Good</SelectItem>
                  <SelectItem value="3">⭐⭐⭐ Average</SelectItem>
                  <SelectItem value="2">⭐⭐ Poor</SelectItem>
                  <SelectItem value="1">⭐ Very Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
