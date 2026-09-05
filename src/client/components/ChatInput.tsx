import {
    useEffect,
    useRef,
    SubmitEventHandler,
    type ChangeEventHandler,
} from "react";

const MAX_HEIGHT = 128;

type ChatInputProps = {
    value: string;
    onChange: ChangeEventHandler<HTMLTextAreaElement>;
    onSubmit: SubmitEventHandler<HTMLFormElement>;
    busy: boolean;
};

export function ChatInput({
    value,
    onChange,
    onSubmit,
    busy,
}: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (e) => {
        resize();
        onChange(e);
    };

    useEffect(() => {
        resize();
        if (value && document.activeElement !== textareaRef.current) {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(value.length, value.length);
        }
    }, [value]);

    function resize() {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    }

    return (
        <form onSubmit={onSubmit} className="composer-area">
            <div className="composer">
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={value}
                    onChange={handleChange}
                    placeholder={
                        busy
                            ? "You can prepare your next instruction…"
                            : "Describe components, boundaries, and relationships…"
                    }
                    className="composer-input hide-scrollbar"
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (!busy) e.currentTarget.form?.requestSubmit();
                        }
                    }}
                />

                <button
                    type="submit"
                    disabled={busy || !value.trim()}
                    className="send-button"
                    aria-label="Send message"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m5 12 14-7-4.5 14-3-5.5L5 12Zm6.5 1.5L19 5" />
                    </svg>
                </button>
            </div>

            <p className="composer-help">
                {busy
                    ? "Working on the previous request"
                    : "↵ Send  ·  Shift ↵ New line"}
            </p>
        </form>
    );
}
