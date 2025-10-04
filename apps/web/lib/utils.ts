import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIsk(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "ISK",
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(Number(value))
      .replace("ISK", "ISK");
  } catch {
    return String(value);
  }
}
