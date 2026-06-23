import { Link } from "react-router-dom";
import { Shield } from "./icons";

export function AppBar({ tag, brandLink = true }: { tag: string; brandLink?: boolean }) {
  const inner = (
    <>
      <Shield />
      <b>
        Renter<span>Passport</span>
      </b>
    </>
  );
  return (
    <header className="appbar">
      {brandLink ? (
        <Link className="appbar__brand" to="/" aria-label="Renter Passport home">
          {inner}
        </Link>
      ) : (
        <span className="appbar__brand">{inner}</span>
      )}
      <div className="appbar__right">
        <span className="appbar__tag">{tag}</span>
      </div>
    </header>
  );
}
