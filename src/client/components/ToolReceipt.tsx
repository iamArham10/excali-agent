type ToolReceiptProps = {
    icon: string;
    text: string;
    error?: boolean;
};

export default function ToolReceipt({
    icon,
    text,
    error = false,
}: ToolReceiptProps) {
    return (
        <div className={`tool-receipt ${error ? "tool-receipt-error" : ""}`}>
            <span aria-hidden="true">{icon}</span>
            <span>{text}</span>
        </div>
    );
}
