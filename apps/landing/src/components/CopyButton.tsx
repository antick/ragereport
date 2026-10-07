import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "Copy command" }: { text: string; label?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  };
  return (
    <div className="copy-control">
      <Button variant="outline" size="sm" onClick={copy} aria-label={label}>
        {status === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {status === "copied" ? "Copied" : "Copy"}
      </Button>
      <output className={status === "error" ? "copy-error" : "sr-only"}>
        {status === "copied"
          ? "Copied to clipboard."
          : status === "error"
            ? "Select the command and copy it manually."
            : ""}
      </output>
    </div>
  );
}
