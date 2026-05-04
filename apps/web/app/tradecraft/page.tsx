import { NotificationsPrompt } from "@/components/notifications/notifications-prompt";
import { TradecraftOverviewContent } from "./_components/tradecraft-overview-content";

export default function TradecraftOverviewPage() {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-5xl space-y-10">
        <NotificationsPrompt />
        <TradecraftOverviewContent />
      </div>
    </div>
  );
}
