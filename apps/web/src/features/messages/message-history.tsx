import type { Id } from "@alloo/backend/dataModel";
import { dateLabel, sameDay } from "@alloo/shared/message-label";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { ConversationDetails } from "../conversations/types";
import { type Message, MessageItem } from "./message-item";

// Measured row wrappers, grouping and date separators share stable virtual item keys in one view.
export function MessageHistory({
  messages,
  virtualizer,
  canPin,
  members,
  userId,
  onReply,
  onAnchor,
  onProfile,
  notify,
}: {
  messages: Message[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  canPin: boolean;
  members: ConversationDetails["members"];
  userId: Id<"users">;
  onReply: (message: Message) => void;
  onAnchor: (id: Id<"messages">) => void;
  onProfile: (author: Message["author"]) => void;
  notify: (text: string) => void;
}) {
  return (
    <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
      {virtualizer.getVirtualItems().map((row) => {
        const m = messages[row.index];
        return (
          <div
            key={row.key}
            ref={virtualizer.measureElement}
            data-index={row.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${row.start}px)`,
            }}
          >
            {(!messages[row.index - 1] ||
              !sameDay(messages[row.index - 1]._creationTime, m._creationTime)) && (
              <div className="date-separator">
                <time dateTime={new Date(m._creationTime).toISOString()}>
                  {dateLabel(m._creationTime)}
                </time>
              </div>
            )}
            <MessageItem
              grouped={
                m.kind === "text" &&
                messages[row.index - 1]?.kind === "text" &&
                messages[row.index - 1]?.userId === m.userId &&
                sameDay(messages[row.index - 1]._creationTime, m._creationTime) &&
                m._creationTime - messages[row.index - 1]._creationTime < 300_000
              }
              message={m}
              userId={userId}
              canPin={canPin}
              onReply={onReply}
              onAnchor={onAnchor}
              notify={notify}
              onProfile={onProfile}
              read={members.some((p) => p.userId !== userId && p.readAt >= m._creationTime)}
            />
          </div>
        );
      })}
    </div>
  );
}
