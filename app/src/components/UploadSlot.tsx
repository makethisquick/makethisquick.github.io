import { useRef } from "react";
import { humanSize, type FileKind } from "../lib/validation";
import type { SlotKey } from "../lib/types";
import { Upload, Check, X } from "./icons";

interface Props {
  slot: SlotKey;
  kind: FileKind;
  title: string;
  subtitle: string;
  icon: JSX.Element;
  required?: boolean;
  skippable?: boolean;
  file?: File;
  skipped: boolean;
  error?: string;
  onSelect: (slot: SlotKey, kind: FileKind, file: File) => void;
  onRemove: (slot: SlotKey) => void;
  onSkip?: (slot: SlotKey, val: boolean) => void;
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/*";

export function UploadSlot(p: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filled = !!p.file;

  let status: string;
  let statusClass = "";
  if (filled) status = "Added";
  else if (p.skipped) status = "Skipped";
  else if (p.required) { status = "Required"; statusClass = "slot__status--req"; }
  else status = "Optional";

  const cls = "slot" + (filled ? " is-filled" : "") + (p.skipped ? " is-skipped" : "") + (p.error ? " is-error" : "");

  return (
    <div className={cls} data-slot={p.slot}>
      <div className="slot__head">
        <span className="slot__ico">{p.icon}</span>
        <div className="slot__txt">
          <b>{p.title}</b>
          <small>{p.subtitle}</small>
        </div>
        <span className={"slot__status " + statusClass}>{status}</span>
      </div>

      {filled ? (
        <div className="slot__file">
          <Check className="tick" />
          <span className="name">{p.file!.name}</span>
          <span className="size">{humanSize(p.file!.size)}</span>
          <button type="button" className="x" aria-label={`Remove ${p.title}`} onClick={() => { p.onRemove(p.slot); if (inputRef.current) inputRef.current.value = ""; }}>
            <X />
          </button>
        </div>
      ) : (
        <div className="slot__actions">
          <label className="slot__pick">
            <Upload /> Upload
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) p.onSelect(p.slot, p.kind, f);
              }}
            />
          </label>
          {p.skippable && p.onSkip && (
            <label className="skip-toggle">
              <input type="checkbox" checked={p.skipped} onChange={(e) => p.onSkip!(p.slot, e.target.checked)} />
              <span className="skip-toggle__box"><Check /></span>
              Skip for now
            </label>
          )}
        </div>
      )}

      {p.error && <p className="slot__err">{p.error}</p>}
    </div>
  );
}
