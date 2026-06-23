import { useEffect, useState } from "react";
import { copyText, toast } from "./Toast";

export function QrModal({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // Generated locally so the tokenized invite URL never leaves the device.
    import("qrcode")
      .then((QR) =>
        QR.toDataURL(url, { width: 220, margin: 1, color: { dark: "#060A18", light: "#ffffff" } })
      )
      .then((d) => alive && setDataUrl(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`QR code — ${label}`} onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <h3>Scan to open</h3>
        <p>{label}</p>
        <div className="modal__qr">
          {dataUrl ? (
            <img src={dataUrl} alt="QR code linking to the invite" />
          ) : (
            <span style={{ color: "#060A18", fontSize: ".85rem" }}>{failed ? "QR unavailable — use the link" : "Generating…"}</span>
          )}
        </div>
        <button className="btn btn--ghost" style={{ width: "100%" }} onClick={() => copyText(url).then(() => toast("Link copied"))}>
          Copy link
        </button>
        <button className="btn btn--primary btn--sm" style={{ width: "100%", marginTop: ".6rem" }} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
