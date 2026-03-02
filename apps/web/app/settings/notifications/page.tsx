import { Suspense } from "react";
import NotificationSettingsPageClient from "./_components/notification-settings-page-client";
import { SettingsPageSkeleton } from "./_components/ui/settings-page-skeleton";

export default function NotificationSettingsPage() {
  // `useSearchParams()` lives in the client shell, so wrap with Suspense.
  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <NotificationSettingsPageClient />
    </Suspense>
  );
}
