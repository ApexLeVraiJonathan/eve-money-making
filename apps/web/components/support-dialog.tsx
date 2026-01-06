"use client";

import * as React from "react";
import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { toast } from "@eve/ui";
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
import type { CreateSupportRequest } from "@eve/api-contracts";

const SUPPORT_CATEGORIES = [
  { value: "technical", label: "Technical Issue" },
  { value: "billing", label: "Billing" },
  { value: "account", label: "Account" },
  { value: "question", label: "General Question" },
  { value: "other", label: "Other" },
] as const;

interface SupportDialogProps {
  children?: React.ReactNode;
}

export function SupportDialog({ children }: SupportDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [includeContext, setIncludeContext] = useState(true);

  const client = useApiClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !subject.trim() || !description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (subject.length > 200) {
      toast.error("Subject must be 200 characters or less");
      return;
    }

    if (description.length > 2000) {
      toast.error("Description must be 2000 characters or less");
      return;
    }

    setLoading(true);

    try {
      const payload: CreateSupportRequest = {
        category,
        subject: subject.trim(),
        description: description.trim(),
        context: includeContext
          ? {
              url: typeof window !== "undefined" ? window.location.href : "",
              userAgent:
                typeof window !== "undefined" ? window.navigator.userAgent : "",
            }
          : undefined,
      };

      await client.post("/support", payload);

      toast.success("Support request submitted successfully");

      // Reset form and close dialog
      setCategory("");
      setSubject("");
      setDescription("");
      setIncludeContext(true);
      setOpen(false);
    } catch (error) {
      console.error("Failed to submit support request:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to submit support request",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setCategory("");
    setSubject("");
    setDescription("");
    setIncludeContext(true);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm">
            <LifeBuoy className="h-4 w-4 mr-2" />
            Support
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Contact Support</DialogTitle>
            <DialogDescription>
              Submit a support request and our team will get back to you
              shortly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="category">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
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
                placeholder="Brief description of your issue"
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
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Provide detailed information about your issue"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={6}
                required
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/2000 characters
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeContext"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="includeContext" className="text-sm font-normal">
                Include technical context (current page, browser info)
              </Label>
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
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
