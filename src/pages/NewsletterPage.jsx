import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BellOff,
  Copy,
  Download,
  LoaderCircle,
  Mail,
  MailPlus,
  RotateCcw,
  Search,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api, downloadFile, formatDate } from "../api.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Drawer from "../components/Drawer.jsx";
import StatTile from "../components/StatTile.jsx";
import { Toasts, useToasts } from "../components/Toasts.jsx";
import ChartCard from "../components/charts/ChartCard.jsx";
import ColumnChart from "../components/charts/ColumnChart.jsx";
import RankedBars from "../components/charts/RankedBars.jsx";
import { formatDay, formatNumber, formatShare } from "../components/charts/chartHelpers.js";

const PAGE_SIZE = 30;
const DAY = 24 * 60 * 60 * 1000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const tabs = [
  { id: "subscribed", label: "Subscribed", test: (person) => person.subscribed },
  { id: "unsubscribed", label: "Unsubscribed", test: (person) => !person.subscribed },
  { id: "all", label: "Everyone", test: () => true },
];

const sortOptions = [
  { id: "newest", label: "Newest first", compare: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  { id: "oldest", label: "Oldest first", compare: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
  { id: "email", label: "Email A–Z", compare: (a, b) => a.email.localeCompare(b.email) },
];

const sourceNames = {
  newsletter: "Homepage form",
  "footer-newsletter": "Footer form",
  admin: "Added by you",
  website: "Website",
};

function sourceName(source) {
  return sourceNames[source] || source || "Unknown";
}

// The local date as "2026-11-09", so days line up with the viewer's own calendar.
function localDay(value) {
  return new Date(value).toLocaleDateString("en-CA");
}

function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months} mo ago` : `${Math.round(months / 12)} y ago`;
}

// Spreadsheet apps run cells that start with these characters as formulas, so we make them plain text.
function safeCell(value) {
  const text = String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function downloadCsv(people) {
  const rows = [["email", "source", "subscribed", "joined"]];
  people.forEach((person) => rows.push([person.email, person.source, person.subscribed ? "yes" : "no", person.createdAt]));
  const csv = rows.map((row) => row.map((cell) => `"${safeCell(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = "newsletter-selected.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function NewsletterPage() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("subscribed");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const { toasts, showToast, removeToast } = useToasts();

  async function loadPeople() {
    try {
      const data = await api("/newsletter?status=all");
      setPeople(data.subscribers);
      setLoadError("");
    } catch (problem) {
      setLoadError(problem.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeople();
  }, []);

  const summary = useMemo(() => {
    const now = Date.now();
    const subscribed = people.filter((person) => person.subscribed);
    const joinedWithin = (from, to) => people.filter((person) => {
      const time = new Date(person.createdAt).getTime();
      return time >= now - from && time < now - to;
    }).length;
    const unsubscribedLately = people.filter(
      (person) => !person.subscribed && person.unsubscribedAt && new Date(person.unsubscribedAt).getTime() >= now - 30 * DAY,
    ).length;

    const dayCounts = {};
    people.forEach((person) => {
      const day = localDay(person.createdAt);
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    const daily = [];
    for (let index = 29; index >= 0; index -= 1) {
      const day = localDay(now - index * DAY);
      daily.push({ date: day, count: dayCounts[day] || 0 });
    }

    const sourceCounts = {};
    subscribed.forEach((person) => {
      sourceCounts[person.source] = (sourceCounts[person.source] || 0) + 1;
    });
    const sources = Object.entries(sourceCounts)
      .map(([source, count]) => ({ id: source, label: sourceName(source), value: count }))
      .sort((a, b) => b.value - a.value);

    return {
      subscribed: subscribed.length,
      unsubscribed: people.length - subscribed.length,
      new30: joinedWithin(30 * DAY, 0),
      previous30: joinedWithin(60 * DAY, 30 * DAY),
      unsubscribedLately,
      daily,
      sources,
    };
  }, [people]);

  const searchText = search.trim().toLowerCase();
  const searched = people.filter((person) => !searchText || person.email.includes(searchText) || sourceName(person.source).toLowerCase().includes(searchText));
  const tabCounts = Object.fromEntries(tabs.map((item) => [item.id, searched.filter(item.test).length]));
  const results = searched.filter(tabs.find((item) => item.id === tab).test).sort(sortOptions.find((item) => item.id === sort).compare);
  const visible = results.slice(0, visibleCount);
  const allVisibleSelected = visible.length > 0 && visible.every((person) => selected.has(person._id));
  const selectedPeople = people.filter((person) => selected.has(person._id));
  const topSource = summary.sources[0];

  function changeTab(id) {
    setTab(id);
    setVisibleCount(PAGE_SIZE);
    setSelected(new Set());
  }

  function toggleSelected(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      visible.forEach((person) => (allVisibleSelected ? next.delete(person._id) : next.add(person._id)));
      return next;
    });
  }

  async function addSubscriber(event) {
    event.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!emailPattern.test(email)) {
      setAddError("Please enter a valid email address.");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const data = await api("/newsletter", { method: "POST", body: { email } });
      showToast(data.message);
      setHighlightId(data.subscriber._id);
      setDrawerOpen(false);
      setNewEmail("");
      setTab("subscribed");
      setSort("newest");
      await loadPeople();
    } catch (problem) {
      setAddError(problem.message);
    } finally {
      setAdding(false);
    }
  }

  async function setSubscribed(person, subscribed) {
    try {
      await api(`/newsletter/${person._id}`, { method: "PUT", body: { subscribed } });
      setPeople((list) =>
        list.map((item) =>
          item._id === person._id ? { ...item, subscribed, unsubscribedAt: subscribed ? null : new Date().toISOString() } : item,
        ),
      );
      showToast(subscribed ? `${person.email} is subscribed again.` : `${person.email} was unsubscribed.`);
    } catch (problem) {
      showToast(problem.message, "error");
    }
  }

  async function runBulk(action) {
    setBusy(true);
    try {
      const data = await api("/newsletter/bulk", { method: "POST", body: { ids: [...selected], action } });
      showToast(`${data.message}.`);
      setSelected(new Set());
      setConfirm(null);
      await loadPeople();
    } catch (problem) {
      showToast(problem.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function askRemove(person) {
    setConfirm({
      title: `Remove ${person.email}?`,
      message: "They'll be deleted from your list completely. If you only want to stop emailing them, unsubscribe them instead.",
      confirmLabel: "Remove",
      onConfirm: async () => {
        setBusy(true);
        try {
          await api(`/newsletter/${person._id}`, { method: "DELETE" });
          setPeople((list) => list.filter((item) => item._id !== person._id));
          showToast(`${person.email} was removed.`);
          setConfirm(null);
        } catch (problem) {
          showToast(problem.message, "error");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function askRemoveSelected() {
    setConfirm({
      title: `Remove ${selected.size} ${selected.size === 1 ? "person" : "people"}?`,
      message: "They'll be deleted from your list completely. If you only want to stop emailing them, unsubscribe them instead.",
      confirmLabel: "Remove",
      onConfirm: () => runBulk("delete"),
    });
  }

  async function copyEmail(person) {
    try {
      await navigator.clipboard.writeText(person.email);
      showToast(`Copied ${person.email}`);
    } catch {
      showToast("Could not copy. Please copy the email by hand.", "error");
    }
  }

  async function exportList() {
    try {
      await downloadFile(`/newsletter/export?status=${tab}`, `newsletter-${tab}.csv`);
    } catch (problem) {
      showToast(problem.message, "error");
    }
  }

  return (
    <div className={`newsletter-page ${selected.size > 0 ? "has-bulk-bar" : ""}`}>
      <div className="page-header">
        <div>
          <h1>Newsletter</h1>
          <p className="muted page-subtitle">People who signed up through the forms on your website.</p>
        </div>
        <div className="quick-actions">
          <button type="button" className="button button-light" onClick={exportList}>
            <Download size={16} aria-hidden /> Export CSV
          </button>
          <button
            type="button"
            className="button button-light"
            onClick={() => {
              setAddError("");
              setDrawerOpen(true);
            }}
          >
            <UserPlus size={16} aria-hidden /> Add subscriber
          </button>
          <Link to="/emails/new" className="button">
            <Send size={16} aria-hidden /> Email subscribers
          </Link>
        </div>
      </div>

      {loadError && <p className="notice notice-error">{loadError}</p>}

      {!loading && (
        <>
          <div className="stat-row">
            <StatTile
              icon={Users}
              label="On the list"
              value={summary.subscribed}
              note={`${formatNumber(summary.unsubscribed)} unsubscribed in total`}
            />
            <StatTile
              icon={MailPlus}
              label="New sign-ups"
              value={summary.new30}
              change={{ now: summary.new30, before: summary.previous30, period: "previous 30 days" }}
              note="In the last 30 days"
            />
            <StatTile
              icon={BellOff}
              label="Unsubscribed lately"
              value={summary.unsubscribedLately}
              note={
                summary.subscribed + summary.unsubscribedLately > 0
                  ? `${formatShare(summary.unsubscribedLately, summary.subscribed + summary.unsubscribedLately)} of the list, last 30 days`
                  : "In the last 30 days"
              }
            />
            <StatTile
              icon={Award}
              label="Top sign-up form"
              value={topSource ? topSource.label : "—"}
              note={topSource ? `${formatShare(topSource.value, summary.subscribed)} of people on the list` : "No sign-ups yet"}
            />
          </div>

          <div className="overview-grid newsletter-charts">
            <ChartCard
              className="span-2"
              title="Sign-ups per day"
              subtitle="New people joining, last 30 days"
              table={
                <table>
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th className="right">Sign-ups</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...summary.daily].reverse().map((row) => (
                      <tr key={row.date}>
                        <td>{formatDay(row.date, true)}</td>
                        <td className="right tabular">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <ColumnChart
                data={summary.daily}
                label="Newsletter sign-ups per day, last 30 days"
                unit={["sign-up", "sign-ups"]}
                height={220}
                emptyText="No sign-ups in the last 30 days."
              />
            </ChartCard>
            <ChartCard title="Where people sign up" subtitle="People on the list, by form">
              {summary.sources.length === 0 ? (
                <p className="muted small chart-empty-inline">Nobody is on the list yet.</p>
              ) : (
                <RankedBars items={summary.sources} unit={["person", "people"]} showThumbs={false} />
              )}
            </ChartCard>
          </div>
        </>
      )}

      <div className="status-tabs" role="tablist" aria-label="Subscriber status">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`status-tab ${tab === item.id ? "is-selected" : ""}`}
            onClick={() => changeTab(item.id)}
          >
            {item.label}
            <span className="status-count">{tabCounts[item.id]}</span>
          </button>
        ))}
      </div>

      <div className="products-toolbar">
        <label className="search-field">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search subscribers</span>
          <input
            type="search"
            placeholder="Search by email or sign-up form…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
              <X size={14} aria-hidden />
            </button>
          )}
        </label>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort">
          {sortOptions.map((option) => (
            <option key={option.id} value={option.id}>
              Sort: {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="form-loading">
          <LoaderCircle size={20} className="spin" aria-hidden /> Loading subscribers…
        </div>
      ) : results.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon" aria-hidden>
            <Mail size={26} />
          </span>
          <h2>{search ? "Nobody matches" : tab === "unsubscribed" ? "Nobody has unsubscribed" : "No subscribers yet"}</h2>
          <p className="muted">
            {search
              ? "Try another search."
              : tab === "unsubscribed"
                ? "Good news. Everyone who signed up is still on the list."
                : "People who sign up on the website will show up here."}
          </p>
          {!search && tab !== "unsubscribed" && (
            <button type="button" className="button" onClick={() => setDrawerOpen(true)}>
              <UserPlus size={16} aria-hidden /> Add subscriber
            </button>
          )}
        </div>
      ) : (
        <div className="card table-card product-table-card">
          <table className="product-table subscriber-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select everyone shown" />
                </th>
                <th>Subscriber</th>
                <th>Signed up from</th>
                <th>Joined</th>
                <th>Status</th>
                <th className="right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((person) => {
                const isSelected = selected.has(person._id);
                return (
                  <tr
                    key={person._id}
                    className={`${isSelected ? "is-selected" : ""} ${person.subscribed ? "" : "is-hidden"} ${person._id === highlightId ? "is-highlighted" : ""}`}
                  >
                    <td className="col-check">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(person._id)}
                        aria-label={`Select ${person.email}`}
                      />
                    </td>
                    <td>
                      <div className="person-cell">
                        <span className="person-avatar" aria-hidden>
                          {person.email.charAt(0).toUpperCase()}
                        </span>
                        <a href={`mailto:${person.email}`} className="product-name">
                          {person.email}
                        </a>
                      </div>
                    </td>
                    <td>
                      <span className={`source-chip source-${person.source}`}>{sourceName(person.source)}</span>
                    </td>
                    <td className="nowrap">
                      <span className="joined-date">{formatDate(person.createdAt)}</span>
                      <span className="muted small"> · {timeAgo(person.createdAt)}</span>
                    </td>
                    <td>
                      {person.subscribed ? (
                        <span className="status-badge is-on">Subscribed</span>
                      ) : (
                        <span className="status-badge" title={person.unsubscribedAt ? `Unsubscribed ${formatDate(person.unsubscribedAt)}` : undefined}>
                          Unsubscribed
                        </span>
                      )}
                    </td>
                    <td className="right">
                      <div className="row-actions">
                        <button type="button" className="action-button" onClick={() => copyEmail(person)} title="Copy email" aria-label={`Copy ${person.email}`}>
                          <Copy size={16} aria-hidden />
                        </button>
                        {person.subscribed ? (
                          <button
                            type="button"
                            className="action-button"
                            onClick={() => setSubscribed(person, false)}
                            title="Unsubscribe"
                            aria-label={`Unsubscribe ${person.email}`}
                          >
                            <UserMinus size={16} aria-hidden />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="action-button"
                            onClick={() => setSubscribed(person, true)}
                            title="Subscribe again"
                            aria-label={`Subscribe ${person.email} again`}
                          >
                            <RotateCcw size={16} aria-hidden />
                          </button>
                        )}
                        <button
                          type="button"
                          className="action-button is-danger"
                          onClick={() => askRemove(person)}
                          title="Remove"
                          aria-label={`Remove ${person.email}`}
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {visible.length < results.length && (
        <div className="show-more">
          <span className="muted small">
            Showing {visible.length} of {results.length}
          </span>
          <button type="button" className="button button-light" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Show more
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="bulk-bar" role="region" aria-label="Actions for selected subscribers">
          <span className="bulk-count">{selected.size} selected</span>
          <div className="bulk-actions">
            <button type="button" onClick={() => runBulk("unsubscribe")} disabled={busy}>
              <UserMinus size={15} aria-hidden /> Unsubscribe
            </button>
            <button type="button" onClick={() => runBulk("subscribe")} disabled={busy}>
              <RotateCcw size={15} aria-hidden /> Subscribe again
            </button>
            <button type="button" onClick={() => downloadCsv(selectedPeople)} disabled={busy}>
              <Download size={15} aria-hidden /> Export
            </button>
            <button type="button" className="bulk-delete" onClick={askRemoveSelected} disabled={busy}>
              <Trash2 size={15} aria-hidden /> Remove
            </button>
          </div>
          <button type="button" className="bulk-close" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <X size={16} aria-hidden />
          </button>
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => !adding && setDrawerOpen(false)}
        title="Add a subscriber"
        subtitle="Only add people who asked to get your emails."
        footer={
          <>
            <button type="button" className="button button-light" onClick={() => setDrawerOpen(false)} disabled={adding}>
              Cancel
            </button>
            <button type="submit" form="subscriber-form" className="button" disabled={adding}>
              {adding && <LoaderCircle size={16} className="spin" aria-hidden />}
              {adding ? "Adding…" : "Add subscriber"}
            </button>
          </>
        }
      >
        <form id="subscriber-form" onSubmit={addSubscriber} noValidate className="product-form-page">
          <div className={`form-field ${addError ? "has-error" : ""}`}>
            <label htmlFor="subscriber-email" className="field-title">
              Email address <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <Mail size={15} aria-hidden />
              <input
                id="subscriber-email"
                type="email"
                value={newEmail}
                onChange={(event) => {
                  setNewEmail(event.target.value);
                  if (addError) setAddError("");
                }}
                placeholder="name@example.com"
                autoComplete="off"
                autoFocus
              />
            </div>
            {addError ? (
              <p className="field-error">{addError}</p>
            ) : (
              <p className="field-hint">They'll be marked as "Added by you". If they unsubscribed before, they'll be subscribed again.</p>
            )}
          </div>
        </form>
      </Drawer>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => !busy && setConfirm(null)}
        busy={busy}
      />
      <Toasts toasts={toasts} onClose={removeToast} />
    </div>
  );
}
