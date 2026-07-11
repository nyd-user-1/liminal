import { EmptyState } from "@/components/ui/empty-state";

// Right pane of the portal messages split view when no thread is open. Below lg
// the list pane owns the screen (inbox-shell), so this only shows on desktop.

export default function PortalMessagesPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon="message"
        title="Select a conversation"
        subtext="Choose a thread from the list, or start a new message to your care team."
      />
    </div>
  );
}
