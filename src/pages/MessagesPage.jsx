import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCheck,
  Copy,
  Gift,
  HelpCircle,
  Inbox,
  LoaderCircle,
  Mail,
  MailOpen,
  Handshake,
  PackagePlus,
  Reply,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { api, formatDate, refreshBadges } from "../api.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { Toasts, useToasts } from "../components/Toasts.jsx";

const reasons = {
  question: { label: "Question", icon: HelpCircle },
  problem: { label: "Problem", icon: TriangleAlert },
  suggestion: { label: "Gift idea", icon: Gift },
  partnership: { label: "Partnership", icon: Handshake },
};

const filters = [
  { id: "all", label: "All", test: () => true },
  { id: "unread", label: "Unread", test: (message) => !message.read },
  ...Object.entries(reasons).map(([id, reason]) => ({ id, label: reason.label, test: (message) => message.reason === id })),
];

function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function replyLink(message) {
  const subject = `Re: your ${reasons[message.reason]?.label.toLowerCase() || "message"}`;
  const quoted = message.message
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  const body = `Hi ${message.name.split(" ")[0]},\n\n\n\n---\nOn ${formatDate(message.createdAt)} you wrote:\n${quoted}`;
  return `mailto:${message.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toasts, showToast, removeToast } = useToasts();
  const listRef = useRef(null);

  const selectedId = searchParams.get("id");

  useEffect(() => {
    api("/messages")
      .then((data) => setMessages(data.messages))
      .catch((problem) => setLoadError(problem.message))
      .finally(() => setLoading(false));
  }, []);

  const searchText = search.trim().toLowerCase();
  const searched = messages.filter(
    (message) => !searchText || `${message.name} ${message.email} ${message.message}`.toLowerCase().includes(searchText),
  );
  const counts = Object.fromEntries(filters.map((item) => [item.id, searched.filter(item.test).length]));
  const shown = searched.filter(filters.find((item) => item.id === filter).test);
  const unreadCount = messages.filter((message) => !message.read).length;
  const selected = useMemo(() => messages.find((message) => message._id === selectedId) || null, [messages, selectedId]);

  async function setRead(message, read, quiet = false) {
    setMessages((list) => list.map((item) => (item._id === message._id ? { ...item, read } : item)));
    try {
      await api(`/messages/${message._id}`, { method: "PUT", body: { read } });
      refreshBadges();
      if (!quiet) showToast(read ? "Marked as read." : "Marked as unread.");
    } catch (problem) {
      setMessages((list) => list.map((item) => (item._id === message._id ? { ...item, read: !read } : item)));
      showToast(problem.message, "error");
    }
  }

  function openMessage(message) {
    setSearchParams({ id: message._id }, { replace: true });
  }

  // Opening a message marks it as read, also when it was opened from a link like the overview.
  const selectedKey = selected?._id;
  useEffect(() => {
    if (selected && !selected.read) setRead(selected, true, true);
  }, [selectedKey]);

  // Up and down arrows move through the list, like in an email app.
  useEffect(() => {
    function handleKey(event) {
      if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
      if (event.target.closest("input, textarea, select, dialog")) return;
      if (shown.length === 0) return;
      event.preventDefault();
      const index = shown.findIndex((message) => message._id === selectedId);
      const nextIndex = event.key === "ArrowDown" ? Math.min(shown.length - 1, index + 1) : Math.max(0, index === -1 ? 0 : index - 1);
      openMessage(shown[nextIndex]);
      const item = listRef.current?.querySelector(`[data-id="${shown[nextIndex]._id}"] button`);
      item?.scrollIntoView({ block: "nearest" });
      item?.focus({ preventScroll: true });
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  async function markAllRead() {
    setBusy(true);
    try {
      const data = await api("/messages/read-all", { method: "POST" });
      setMessages((list) => list.map((item) => ({ ...item, read: true })));
      refreshBadges();
      showToast(`${data.message}.`);
    } catch (problem) {
      showToast(problem.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function askDelete(message) {
    setConfirm({
      title: `Delete the message from ${message.name}?`,
      message: "It will be removed for good. Reply first if you still need to.",
      onConfirm: async () => {
        setBusy(true);
        try {
          await api(`/messages/${message._id}`, { method: "DELETE" });
          const index = shown.findIndex((item) => item._id === message._id);
          const next = shown[index + 1] || shown[index - 1];
          setMessages((list) => list.filter((item) => item._id !== message._id));
          if (next) setSearchParams({ id: next._id }, { replace: true });
          else setSearchParams({}, { replace: true });
          refreshBadges();
          showToast("Message deleted.");
          setConfirm(null);
        } catch (problem) {
          showToast(problem.message, "error");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  async function copyEmail(message) {
    try {
      await navigator.clipboard.writeText(message.email);
      showToast(`Copied ${message.email}`);
    } catch {
      showToast("Could not copy. Please copy the email by hand.", "error");
    }
  }

  return (
    <div className={`messages-page ${selected ? "has-selection" : ""}`}>
      <div className="page-header">
        <div>
          <h1>Messages</h1>
          <p className="muted page-subtitle">
            {loading ? "Loading…" : unreadCount > 0 ? `${unreadCount} unread · from the contact form on your About page` : "All caught up · from the contact form on your About page"}
          </p>
        </div>
        <button type="button" className="button button-light" onClick={markAllRead} disabled={busy || unreadCount === 0}>
          <CheckCheck size={16} aria-hidden /> Mark all as read
        </button>
      </div>

      {loadError && <p className="notice notice-error">{loadError}</p>}

      <div className="inbox card">
        <section className="inbox-list" aria-label="Messages">
          <div className="inbox-tools">
            <label className="search-field">
              <Search size={16} aria-hidden />
              <span className="sr-only">Search messages</span>
              <input type="search" placeholder="Search messages…" value={search} onChange={(event) => setSearch(event.target.value)} />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                  <X size={14} aria-hidden />
                </button>
              )}
            </label>
            <div className="filter-chips" role="group" aria-label="Filter messages">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={filter === item.id}
                  className={`filter-chip ${filter === item.id ? "is-selected" : ""}`}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                  <span>{counts[item.id]}</span>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="form-loading inbox-empty">
              <LoaderCircle size={20} className="spin" aria-hidden /> Loading messages…
            </div>
          ) : shown.length === 0 ? (
            <div className="inbox-empty">
              <Inbox size={28} aria-hidden />
              <p>{messages.length === 0 ? "No messages yet." : "Nothing matches."}</p>
              <span className="muted small">
                {messages.length === 0 ? "Messages from the contact form on your About page land here." : "Try another filter or search."}
              </span>
            </div>
          ) : (
            <ul className="message-items" ref={listRef}>
              {shown.map((message) => {
                const reason = reasons[message.reason] || reasons.question;
                const isSelected = message._id === selectedId;
                return (
                  <li key={message._id} data-id={message._id}>
                    <button
                      type="button"
                      className={`message-item ${message.read ? "" : "is-unread"} ${isSelected ? "is-selected" : ""}`}
                      onClick={() => openMessage(message)}
                      aria-current={isSelected ? "true" : undefined}
                    >
                      <span className="message-avatar" aria-hidden>
                        {message.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="message-item-text">
                        <span className="message-item-top">
                          <span className="message-from">{message.name}</span>
                          <span className="message-time">{timeAgo(message.createdAt)}</span>
                        </span>
                        <span className="message-reason">
                          <reason.icon size={12} aria-hidden /> {reason.label}
                        </span>
                        <span className="message-snippet">{message.message}</span>
                      </span>
                      {!message.read && <span className="unread-dot" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="inbox-reader" aria-label="Selected message">
          {selected ? (
            <MessageReader
              message={selected}
              onBack={() => setSearchParams({}, { replace: true })}
              onCopy={copyEmail}
              onToggleRead={() => setRead(selected, !selected.read)}
              onDelete={() => askDelete(selected)}
            />
          ) : (
            <div className="reader-empty">
              <span className="empty-icon" aria-hidden>
                <MailOpen size={26} />
              </span>
              <p>Pick a message to read it.</p>
              <span className="muted small">Tip: use the ↑ and ↓ keys to move between messages.</span>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Delete"
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => !busy && setConfirm(null)}
        busy={busy}
      />
      <Toasts toasts={toasts} onClose={removeToast} />
    </div>
  );
}

function MessageReader({ message, onBack, onCopy, onToggleRead, onDelete }) {
  const reason = reasons[message.reason] || reasons.question;

  return (
    <article className="reader">
      <div className="reader-toolbar">
        <button type="button" className="icon-button reader-back" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden /> All messages
        </button>
        <div className="row-actions">
          <button type="button" className="action-button" onClick={onToggleRead} title={message.read ? "Mark as unread" : "Mark as read"}>
            {message.read ? <Mail size={17} aria-hidden /> : <MailOpen size={17} aria-hidden />}
            <span className="sr-only">{message.read ? "Mark as unread" : "Mark as read"}</span>
          </button>
          <button type="button" className="action-button is-danger" onClick={onDelete} title="Delete">
            <Trash2 size={17} aria-hidden />
            <span className="sr-only">Delete</span>
          </button>
        </div>
      </div>

      <header className="reader-header">
        <span className="reader-avatar" aria-hidden>
          {message.name.charAt(0).toUpperCase()}
        </span>
        <div className="reader-from">
          <h2>{message.name}</h2>
          <button type="button" className="reader-email" onClick={() => onCopy(message)} title="Copy email">
            {message.email} <Copy size={13} aria-hidden />
          </button>
        </div>
        <div className="reader-meta">
          <span className={`reason-pill reason-${message.reason}`}>
            <reason.icon size={13} aria-hidden /> {reason.label}
          </span>
          <time dateTime={message.createdAt} className="muted small">
            {new Date(message.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </div>
      </header>

      <div className="reader-body">{message.message}</div>

      <footer className="reader-actions">
        <a className="button" href={replyLink(message)}>
          <Reply size={16} aria-hidden /> Reply by email
        </a>
        {message.reason === "suggestion" && (
          <Link to="/products/new" className="button button-light">
            <PackagePlus size={16} aria-hidden /> Add as a product
          </Link>
        )}
      </footer>
    </article>
  );
}
