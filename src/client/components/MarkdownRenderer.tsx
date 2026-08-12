import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

type MarkdownRendererProp = {
    content: string;
};

function MarkdownRenderer({ content }: MarkdownRendererProp) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
                a: ({ node, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
                code: ({ node, className, children, ...props }) => (
                    <code
                        className={`${className ?? ""} rounded px-1`}
                        {...props}
                    >
                        {children}
                    </code>
                ),
            }}
        >
            {content}
        </ReactMarkdown>
    );
}

// memo avoids re-parsing markdown on every parent re-render
// unless the actual text content changed
export default memo(MarkdownRenderer);
