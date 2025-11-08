"use client";

import * as React from "react";

type Toast = {
  id: number;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error";
};

type ToastContextValue = {
  toast: (t: Omit<Toast, "id">) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(
  undefined,
);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const nextId = React.useRef(1);

  const add = React.useCallback((t: Omit<Toast, "id">) => {
    const id = nextId.current++;
    const toast: Toast = { id, ...t };
    setToasts((prev) => [...prev, toast]);
    // auto dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast: add }}>
      {children}
      <Toaster toasts={toasts} />
    </ToastContext.Provider>
  );
}

function Toaster({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={
            "rounded-md border px-4 py-3 shadow bg-background text-foreground text-sm max-w-sm " +
            (t.variant === "success"
              ? "border-green-600"
              : t.variant === "error"
                ? "border-red-600"
                : "border-muted")
          }
        >
          <div className="font-medium">{t.title}</div>
          {t.description && (
            <div className="text-xs text-muted-foreground mt-1">
              {t.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
