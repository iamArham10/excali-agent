import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

type MarkdownRendererProp = {
    content: string;
};

function MarkdownRenderer({ content }: MarkdownRendererProp) {
    return (
        <div className="markdown">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                    a: ({ node, ...props }) => (
                        <a {...props} target="_blank" rel="noopener noreferrer" />
                    ),
                    code: ({ node, className, children, ...props }) => (
                        <code className={className ?? ""} {...props}>
                            {children}
                        </code>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

// memo avoids re-parsing markdown on every parent re-render
// unless the actual text content changed
export default memo(MarkdownRenderer);
