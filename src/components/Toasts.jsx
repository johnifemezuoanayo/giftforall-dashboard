import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, X, XCircle } from "lucide-react";

// Small messages in the corner that go away on their own.
export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (text, type = "success") => {
      const id = Date.now() + Math.random();
      setToasts((list) => [...list.slice(-2), { id, text, type }]);
      setTimeout(() => removeToast(id), type === "error" ? 6000 : 3500);
    },
    [removeToast],
  );

  return { toasts, showToast, removeToast };
}

export function Toasts({ toasts, onClose }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.type === "error" ? <XCircle size={18} aria-hidden /> : <CheckCircle2 size={18} aria-hidden />}
          <span>{toast.text}</span>
          <button type="button" onClick={() => onClose(toast.id)} aria-label="Close message">
            <X size={15} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

// Shows a message passed from the previous page, like "Product was deleted", once.
export function useToastFromNavigation(showToast) {
  const location = useLocation();
  const navigate = useNavigate();
  const shownFor = useRef(null);

  useEffect(() => {
    const text = location.state?.toast;
    if (!text || shownFor.current === location.key) return;
    shownFor.current = location.key;
    showToast(text);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location, navigate, showToast]);
}
