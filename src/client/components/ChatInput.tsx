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
    disabled: boolean;
};

export function ChatInput({
    value,
    onChange,
    onSubmit,
    disabled,
}: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (e) => {
        resize();
        onChange(e);
    };

    useEffect(() => {
        resize();
    }, [value]);

    function resize() {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    }

    return (
        <form onSubmit={onSubmit} className="w-full max-w-3xl mx-auto px-4">
            {/* The "Composer" Box */}
            <div
                className={`
                  flex items-center gap-2 justify-between
                  bg-white
                  border border-zinc-200
                  rounded-2xl
                  shadow-sm
                  px-4 py-3
                  transition-all duration-200
                  ${!disabled ? "focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500" : "opacity-60"}
                `}
            >
                {/* The Input */}
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={value}
                    onChange={handleChange}
                    disabled={disabled}
                    placeholder="Tell the agent what to draw..."
                    className="
                    flex-1
                    resize-none
                    overflow-y-auto
                    hide-scrollbar
                    bg-transparent
                    placeholder-zinc-400
                    outline-none
                    max-h-32
                    text-base
                    leading-6
                  "
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            e.currentTarget.form?.requestSubmit();
                        }
                    }}
                />

                {/* The Send Button */}
                <button
                    type="submit"
                    disabled={disabled || !value.trim()}
                    className={`
                    p-2 rounded-xl
                    mt-0.5 mb-0.5
                    mr-0.5 ml-0.5
                    px-3
                    transition-colors duration-200
                    ${
                        value.trim() && !disabled
                            ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                            : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                    }
                  `}
                    aria-label="Send message"
                >
                    {disabled ? (
                        // Loading Spinner (shown when agent is working)
                        <svg
                            className="animate-spin h-5 w-5"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                        </svg>
                    ) : (
                        <span className="h-5 w-5">send</span>
                    )}
                </button>
            </div>

            {/* Optional: Helper text */}
            <p className="text-xs text-zinc-400 mt-4 mb-2 text-center">
                Press Enter to send, Shift+Enter for new line
            </p>
        </form>
    );
}
