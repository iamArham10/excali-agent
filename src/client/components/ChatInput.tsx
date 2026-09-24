import {
    useEffect,
    useRef,
    type ChangeEventHandler,
    type FormEventHandler,
} from "react";
import { Icon } from "./Icons";

const MAX_HEIGHT = 180;

type ChatInputProps = {
    value: string;
    onChange: ChangeEventHandler<HTMLTextAreaElement>;
    onSubmit: FormEventHandler<HTMLFormElement>;
    onStop?: () => void;
    busy: boolean;
};

export function ChatInput({
    value,
    onChange,
    onSubmit,
    onStop,
    busy,
}: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
        if (value && document.activeElement !== el) {
            el.focus();
            el.setSelectionRange(value.length, value.length);
        }
    }, [value]);

    return (
        <form onSubmit={onSubmit} className="composer-area">
            <div className="composer">
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={value}
                    onChange={onChange}
                    placeholder={
                        busy
                            ? "Queue up your next instruction…"
                            : "Describe a diagram or an edit…"
                    }
                    className="composer__input"
                    aria-label="Message"
                    onKeyDown={(e) => {
                        if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            !e.nativeEvent.isComposing
                        ) {
                            e.preventDefault();
                            if (!busy) e.currentTarget.form?.requestSubmit();
                        }
                    }}
                />
                <div className="composer__footer">
                    <span className="composer__hint">
                        <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+
                        <kbd>Enter</kbd> for a new line
                    </span>
                    {busy && onStop ? (
                        <button
                            type="button"
                            className="composer__send composer__send--stop"
                            onClick={onStop}
                            aria-label="Stop generating"
                        >
                            <Icon name="stop" size={14} />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={busy || !value.trim()}
                            className="composer__send"
                            aria-label="Send message"
                        >
                            <Icon name="arrow-up" size={16} />
                        </button>
                    )}
                </div>
            </div>
        </form>
    );
}
