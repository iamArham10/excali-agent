import { useState } from "react";
import { Icon } from "./Icons";

type ReasoningBlockProps = {
    text: string;
    streaming: boolean;
};

export default function ReasoningBlock({ text, streaming }: ReasoningBlockProps) {
    const [open, setOpen] = useState(false);
    const content = text.trim();

    // Some providers only signal that reasoning happened, without the text.
    if (!content && !streaming) return null;

    return (
        <div className="reasoning" data-open={open && !!content}>
            <button
                type="button"
                className="reasoning__toggle"
                onClick={() => content && setOpen((value) => !value)}
                aria-expanded={content ? open : undefined}
                disabled={!content}
            >
                <Icon name="brain" size={14} />
                <span className={streaming ? "shimmer" : ""}>{streaming ? "Thinking" : "Thought process"}</span>
                {content && (
                    <span className="reasoning__chevron">
                        <Icon name="chevron" size={12} />
                    </span>
                )}
            </button>
            {open && content && <div className="reasoning__content">{content}</div>}
        </div>
    );
}
