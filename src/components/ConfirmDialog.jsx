import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({ open, title, message, confirmLabel = "Delete", onConfirm, onCancel, busy = false }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => event.target === dialogRef.current && onCancel()}
    >
      <div className="confirm-body">
        <span className="confirm-icon" aria-hidden>
          <AlertTriangle size={22} />
        </span>
        <div>
          <h2>{title}</h2>
          <p className="muted">{message}</p>
        </div>
      </div>
      <div className="confirm-actions">
        <button type="button" className="button button-light" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="button button-solid-danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
