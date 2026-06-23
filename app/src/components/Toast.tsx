import { useEffect, useState } from "react";
import { Check } from "./icons";

let timer: number | undefined;

export function toast(msg: string): void {
  window.dispatchEvent(new CustomEvent<string>("rp-toast", { detail: msg }));
}

export function ToastHost() {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  useEffect(() => {
    function handler(e: Event) {
      setMsg((e as CustomEvent<string>).detail);
      setOn(true);
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(() => setOn(false), 2400);
    }
    window.addEventListener("rp-toast", handler);
    return () => window.removeEventListener("rp-toast", handler);
  }, []);
  return (
    <div className={"toast" + (on ? " is-on" : "")} role="status" aria-live="polite">
      <Check />
      <span>{msg}</span>
    </div>
  );
}

/* Clipboard with a legacy fallback. */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}
