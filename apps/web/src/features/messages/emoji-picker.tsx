import { REACTIONS, validReaction } from "@alloo/shared/policy";
import { useState } from "react";
import { Modal } from "../../components/ui/modal";

const EMOJIS = [
  ...REACTIONS,
  "🎉",
  "🔥",
  "🥰",
  "😍",
  "😘",
  "😊",
  "😁",
  "😎",
  "🤔",
  "😴",
  "😅",
  "🤣",
  "🥳",
  "😭",
  "😡",
  "🤯",
  "🤗",
  "🫶",
  "💪",
  "👏",
  "👀",
  "✅",
  "❌",
  "💯",
  "☕",
  "🍕",
  "🐱",
  "🐶",
  "🌈",
  "✨",
  "🚀",
  "🇫🇷",
  "🇧🇪",
  "🇨🇦",
  "👍🏽",
  "👨‍👩‍👧‍👦",
];
export function EmojiPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}) {
  const [custom, setCustom] = useState("");
  function choose(emoji: string) {
    onSelect(emoji);
    setCustom("");
    onClose();
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choisir un emoji"
      description="Choisissez une réaction ou collez un emoji depuis votre clavier."
    >
      <div className="emoji-grid">
        {EMOJIS.map((emoji) => (
          <button
            type="button"
            key={emoji}
            aria-label={`Choisir ${emoji}`}
            onClick={() => choose(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (validReaction(custom)) choose(custom);
        }}
      >
        <label>
          Autre emoji
          <input
            aria-label="Autre emoji"
            maxLength={32}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="🦊"
          />
        </label>
        {custom && !validReaction(custom) && <p role="status">Saisissez un seul emoji.</p>}
        <button type="submit" disabled={!validReaction(custom)}>
          Utiliser cet emoji
        </button>
      </form>
    </Modal>
  );
}
