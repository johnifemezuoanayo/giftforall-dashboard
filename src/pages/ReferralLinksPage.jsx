import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Copy,
  ExternalLink,
  Link2,
  LoaderCircle,
  MousePointerClick,
  PauseCircle,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { API_URL, api, formatDate, thumbUrl } from "../api.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Drawer from "../components/Drawer.jsx";
import Switch from "../components/Switch.jsx";
import { Toasts, useToasts } from "../components/Toasts.jsx";
import MiniBars from "../components/charts/MiniBars.jsx";
import { formatNumber } from "../components/charts/chartHelpers.js";

const PAGE_SIZE = 25;

const tabs = [
  { id: "all", label: "All links", test: () => true },
  { id: "product", label: "Product links", test: (link) => Boolean(link.product) },
  { id: "own", label: "Your own links", test: (link) => !link.product },
  { id: "paused", label: "Paused", test: (link) => !link.active },
];

const sortOptions = [
  { id: "recent", label: "Most clicked (30 days)", compare: (a, b) => b.clicksLast30Days - a.clicksLast30Days || b.clicks - a.clicks },
  { id: "total", label: "Most clicked (all time)", compare: (a, b) => b.clicks - a.clicks },
  { id: "last", label: "Clicked most recently", compare: (a, b) => new Date(b.lastClickedAt || 0) - new Date(a.lastClickedAt || 0) },
  { id: "newest", label: "Newest first", compare: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  { id: "name", label: "Name A–Z", compare: (a, b) => a.name.localeCompare(b.name) },
];

const shopOptions = [
  { id: "amazon", label: "Amazon", color: "var(--series-1)" },
  { id: "temu", label: "Temu", color: "var(--series-2)" },
  { id: "", label: "Other", color: "var(--series-other)" },
];

const emptyForm = { name: "", code: "", destinationUrl: "", retailer: "", active: true };

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function timeAgo(value) {
  if (!value) return "Never";
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(value);
}

function checkForm(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Give the link a name, like “Instagram bio”.";
  if (!/^https?:\/\/\S+$/.test(form.destinationUrl.trim())) errors.destinationUrl = "Paste the full address, starting with https://";
  return errors;
}

export default function ReferralLinksPage() {
  const navigate = useNavigate();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const { toasts, showToast, removeToast } = useToasts();

  async function loadLinks() {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data = await api(`/referrals?tz=${encodeURIComponent(timeZone)}`);
      setLinks(data.referrals);
      setLoadError("");
    } catch (problem) {
      setLoadError(problem.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLinks();
  }, []);

  const totals = useMemo(
    () => ({
      recent: links.reduce((sum, link) => sum + link.clicksLast30Days, 0),
      allTime: links.reduce((sum, link) => sum + link.clicks, 0),
      own: links.filter((link) => !link.product).length,
      paused: links.filter((link) => !link.active).length,
    }),
    [links],
  );

  const searchText = search.trim().toLowerCase();
  const searched = links.filter((link) =>
    !searchText ? true : `${link.name} ${link.code} ${link.destinationUrl}`.toLowerCase().includes(searchText),
  );
  const tabCounts = Object.fromEntries(tabs.map((item) => [item.id, searched.filter(item.test).length]));
  const results = searched.filter(tabs.find((item) => item.id === tab).test).sort(sortOptions.find((item) => item.id === sort).compare);
  const visible = results.slice(0, visibleCount);

  function openCreate() {
    setForm(emptyForm);
    setFormErrors({});
    setDrawer({ mode: "create" });
  }

  function openEdit(link) {
    if (link.product) {
      navigate(`/products/${link.product._id}`);
      return;
    }
    setForm({ name: link.name, code: link.code, destinationUrl: link.destinationUrl, retailer: link.retailer || "", active: link.active });
    setFormErrors({});
    setDrawer({ mode: "edit", link });
  }

  function closeDrawer() {
    if (!saving) setDrawer(null);
  }

  function updateForm(changes) {
    setForm((current) => {
      const next = { ...current, ...changes };
      if (Object.keys(formErrors).length > 0) setFormErrors(checkForm(next));
      return next;
    });
  }

  async function saveForm(event) {
    event.preventDefault();
    const found = checkForm(form);
    setFormErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const body = { ...form, code: slugify(form.code || form.name) };
    try {
      if (drawer.mode === "create") {
        const data = await api("/referrals", { method: "POST", body });
        showToast(`"${data.referral.name}" created. Copy it from the list.`);
        setHighlightId(data.referral._id);
        setTab("all");
        setSort("newest");
      } else {
        await api(`/referrals/${drawer.link._id}`, { method: "PUT", body });
        showToast("Link saved.");
        setHighlightId(drawer.link._id);
      }
      setDrawer(null);
      await loadLinks();
    } catch (problem) {
      setFormErrors({ server: problem.message });
    } finally {
      setSaving(false);
    }
  }

  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link.url);
      showToast(`Copied ${link.url.replace(/^https?:\/\//, "")}`);
    } catch {
      showToast("Could not copy. Please copy the link by hand.", "error");
    }
  }

  async function setActive(link, active) {
    setLinks((list) => list.map((item) => (item._id === link._id ? { ...item, active } : item)));
    try {
      await api(`/referrals/${link._id}`, { method: "PUT", body: { active } });
      showToast(active ? `"${link.name}" is on again.` : `"${link.name}" is paused. Visitors go to your homepage instead.`);
    } catch (problem) {
      setLinks((list) => list.map((item) => (item._id === link._id ? { ...item, active: !active } : item)));
      showToast(problem.message, "error");
    }
  }

  function askReset(link) {
    setConfirm({
      title: `Reset clicks for "${link.name}"?`,
      message: `This sets its ${formatNumber(link.clicks)} clicks back to 0 and removes its click history from the charts.`,
      confirmLabel: "Reset clicks",
      onConfirm: async () => {
        setBusy(true);
        try {
          await api(`/referrals/${link._id}`, { method: "PUT", body: { resetClicks: true } });
          showToast("Clicks reset.");
          setConfirm(null);
          await loadLinks();
        } catch (problem) {
          showToast(problem.message, "error");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function askDelete(link) {
    setConfirm({
      title: `Delete "${link.name}"?`,
      message: "Anyone who still uses this link will land on your homepage. Its click history is removed too.",
      confirmLabel: "Delete link",
      onConfirm: async () => {
        setBusy(true);
        try {
          await api(`/referrals/${link._id}`, { method: "DELETE" });
          setLinks((list) => list.filter((item) => item._id !== link._id));
          showToast(`"${link.name}" was deleted.`);
          setConfirm(null);
        } catch (problem) {
          showToast(problem.message, "error");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  const codePreview = slugify(form.code || form.name) || "your-code";
  const destinationIsValid = /^https?:\/\/\S+$/.test(form.destinationUrl.trim());

  return (
    <div className="referrals-page">
      <div className="page-header">
        <div>
          <h1>Referral links</h1>
          <p className="muted page-subtitle">Short links that count every visit, then send people on to the shop.</p>
        </div>
        <button type="button" className="button" onClick={openCreate}>
          <Plus size={16} aria-hidden /> New link
        </button>
      </div>

      {loadError && <p className="notice notice-error">{loadError}</p>}

      <div className="link-stats">
        <div className="link-stat">
          <span className="link-stat-icon" aria-hidden>
            <MousePointerClick size={18} />
          </span>
          <div>
            <p className="link-stat-value">{formatNumber(totals.recent)}</p>
            <p className="link-stat-label">Clicks in the last 30 days</p>
          </div>
        </div>
        <div className="link-stat">
          <span className="link-stat-icon" aria-hidden>
            <Sparkles size={18} />
          </span>
          <div>
            <p className="link-stat-value">{formatNumber(totals.allTime)}</p>
            <p className="link-stat-label">Clicks of all time</p>
          </div>
        </div>
        <div className="link-stat">
          <span className="link-stat-icon" aria-hidden>
            <Link2 size={18} />
          </span>
          <div>
            <p className="link-stat-value">{totals.own}</p>
            <p className="link-stat-label">Your own links · {links.length - totals.own} product links</p>
          </div>
        </div>
        <div className="link-stat">
          <span className="link-stat-icon" aria-hidden>
            <PauseCircle size={18} />
          </span>
          <div>
            <p className="link-stat-value">{totals.paused}</p>
            <p className="link-stat-label">Paused links</p>
          </div>
        </div>
      </div>

      <div className="status-tabs" role="tablist" aria-label="Link type">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`status-tab ${tab === item.id ? "is-selected" : ""}`}
            onClick={() => {
              setTab(item.id);
              setVisibleCount(PAGE_SIZE);
            }}
          >
            {item.label}
            <span className="status-count">{tabCounts[item.id]}</span>
          </button>
        ))}
      </div>

      <div className="products-toolbar">
        <label className="search-field">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search links</span>
          <input
            type="search"
            placeholder="Search by name, code or address…"
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
          <LoaderCircle size={20} className="spin" aria-hidden /> Loading links…
        </div>
      ) : results.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon" aria-hidden>
            <Link2 size={26} />
          </span>
          <h2>{search || tab !== "all" ? "No links match" : "No referral links yet"}</h2>
          <p className="muted">
            {search || tab !== "all"
              ? "Try another search or tab."
              : "Make a short link for your Instagram bio, a newsletter or anywhere you share gifts."}
          </p>
          <button type="button" className="button" onClick={openCreate}>
            <Plus size={16} aria-hidden /> New link
          </button>
        </div>
      ) : (
        <div className="card table-card product-table-card">
          <table className="product-table link-table">
            <thead>
              <tr>
                <th>Link</th>
                <th>Short link</th>
                <th>Goes to</th>
                <th>Last 14 days</th>
                <th className="right">All time</th>
                <th>Last click</th>
                <th className="center">On</th>
                <th className="right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((link) => (
                <LinkRow
                  key={link._id}
                  link={link}
                  highlighted={link._id === highlightId}
                  onCopy={copyLink}
                  onEdit={openEdit}
                  onActive={setActive}
                  onReset={askReset}
                  onDelete={askDelete}
                />
              ))}
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

      <Drawer
        open={Boolean(drawer)}
        onClose={closeDrawer}
        title={drawer?.mode === "edit" ? "Edit link" : "New referral link"}
        subtitle={drawer?.mode === "edit" ? `Created ${formatDate(drawer.link.createdAt)}` : "Share it anywhere. Every visit is counted."}
        footer={
          <>
            <button type="button" className="button button-light" onClick={closeDrawer} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="link-form" className="button" disabled={saving}>
              {saving && <LoaderCircle size={16} className="spin" aria-hidden />}
              {saving ? "Saving…" : drawer?.mode === "edit" ? "Save link" : "Create link"}
            </button>
          </>
        }
      >
        <form id="link-form" onSubmit={saveForm} noValidate className="product-form-page">
          {formErrors.server && <p className="notice notice-error">{formErrors.server}</p>}

          <div className={`form-field ${formErrors.name ? "has-error" : ""}`}>
            <label htmlFor="link-name" className="field-title">
              Name <span className="required">*</span>
            </label>
            <input
              id="link-name"
              value={form.name}
              onChange={(event) => updateForm({ name: event.target.value })}
              placeholder="e.g. Instagram bio"
              maxLength={80}
              autoFocus
            />
            {formErrors.name && <p className="field-error">{formErrors.name}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="link-code" className="field-title">
              Short code <span className="optional">optional</span>
            </label>
            <div className="input-with-prefix">
              <span className="input-prefix">/go/</span>
              <input
                id="link-code"
                value={form.code}
                onChange={(event) => updateForm({ code: event.target.value })}
                onBlur={() => form.code && updateForm({ code: slugify(form.code) })}
                placeholder={slugify(form.name) || "made-from-the-name"}
              />
            </div>
            <p className="field-hint">Letters, numbers and dashes. Left empty, it's made from the name.</p>
          </div>

          <div className="link-preview">
            <span className="muted small">Your link</span>
            <code>
              {API_URL.replace(/^https?:\/\//, "")}/go/<strong>{codePreview}</strong>
            </code>
          </div>

          <div className={`form-field ${formErrors.destinationUrl ? "has-error" : ""}`}>
            <label htmlFor="link-destination" className="field-title">
              Send visitors to <span className="required">*</span>
            </label>
            <div className="input-with-button">
              <div className="input-with-icon">
                <Link2 size={15} aria-hidden />
                <input
                  id="link-destination"
                  type="url"
                  value={form.destinationUrl}
                  onChange={(event) => updateForm({ destinationUrl: event.target.value.trim() })}
                  placeholder="https://www.amazon.com/shop/…"
                />
              </div>
              <a
                href={destinationIsValid ? form.destinationUrl : undefined}
                target="_blank"
                rel="noreferrer"
                className={`button button-light ${destinationIsValid ? "" : "is-disabled"}`}
                aria-disabled={!destinationIsValid}
              >
                <ExternalLink size={15} aria-hidden /> Test
              </a>
            </div>
            {formErrors.destinationUrl && <p className="field-error">{formErrors.destinationUrl}</p>}
          </div>

          <div className="form-field">
            <span className="field-title" id="link-shop-label">
              Shop
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="link-shop-label">
              {shopOptions.map((shop) => (
                <button
                  key={shop.label}
                  type="button"
                  role="radio"
                  aria-checked={form.retailer === shop.id}
                  className={form.retailer === shop.id ? "is-selected" : ""}
                  onClick={() => updateForm({ retailer: shop.id })}
                >
                  <span className="shop-dot" style={{ background: shop.color }} aria-hidden />
                  {shop.label}
                </button>
              ))}
            </div>
            <p className="field-hint">Used for the "Clicks by shop" chart on the overview.</p>
          </div>

          <label className="toggle-row">
            <span>
              <strong>Link is on</strong>
              <span className="muted small">When it's paused, visitors land on your homepage instead.</span>
            </span>
            <Switch checked={form.active} onChange={(active) => updateForm({ active })} label="Link is on" />
          </label>
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

function LinkRow({ link, highlighted, onCopy, onEdit, onActive, onReset, onDelete }) {
  const shop = shopOptions.find((item) => item.id === (link.retailer || "")) || shopOptions[2];
  const image = link.product?.image?.src;

  return (
    <tr className={`${link.active ? "" : "is-hidden"} ${highlighted ? "is-highlighted" : ""}`}>
      <td>
        <div className="product-cell link-cell">
          {image ? (
            <img src={thumbUrl(image)} alt="" className="product-thumb small" loading="lazy" />
          ) : (
            <span className="link-icon" aria-hidden>
              <Link2 size={18} />
            </span>
          )}
          <div className="product-cell-text">
            {link.product ? (
              <Link to={`/products/${link.product._id}`} className="product-name">
                {link.name}
              </Link>
            ) : (
              <button type="button" className="product-name as-link" onClick={() => onEdit(link)}>
                {link.name}
              </button>
            )}
            <span className="product-meta">
              <span className={`type-pill ${link.product ? "" : "is-own"}`}>{link.product ? "Product" : "Your link"}</span>
              {!link.active && <span className="hidden-pill">Paused</span>}
            </span>
          </div>
        </div>
      </td>
      <td>
        <button type="button" className="short-link" onClick={() => onCopy(link)} title="Copy link">
          /go/{link.code}
          <Copy size={13} aria-hidden />
        </button>
      </td>
      <td>
        <a href={link.destinationUrl} target="_blank" rel="noreferrer" className="destination" title={link.destinationUrl}>
          <span className="shop-dot" style={{ background: shop.color }} aria-hidden />
          {domainOf(link.destinationUrl)}
        </a>
      </td>
      <td>
        <div className="recent-clicks">
          <MiniBars values={link.dailyClicks} />
          <span className="small">
            <strong>{formatNumber(link.clicksLast30Days)}</strong> <span className="muted">in 30 days</span>
          </span>
        </div>
      </td>
      <td className="right tabular strong-number">{formatNumber(link.clicks)}</td>
      <td className="small muted nowrap" title={link.lastClickedAt ? formatDate(link.lastClickedAt) : undefined}>
        {timeAgo(link.lastClickedAt)}
      </td>
      <td className="center">
        <Switch checked={link.active} onChange={(active) => onActive(link, active)} label={`Link is on: ${link.name}`} />
      </td>
      <td className="right">
        <div className="row-actions">
          <button type="button" className="action-button" onClick={() => onCopy(link)} title="Copy link" aria-label={`Copy ${link.name}`}>
            <Copy size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="action-button"
            onClick={() => onEdit(link)}
            title={link.product ? "Edit on the product page" : "Edit"}
            aria-label={`Edit ${link.name}`}
          >
            <Pencil size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="action-button"
            onClick={() => onReset(link)}
            title="Reset clicks"
            aria-label={`Reset clicks for ${link.name}`}
            disabled={link.clicks === 0}
          >
            <RotateCcw size={16} aria-hidden />
          </button>
          {!link.product && (
            <button
              type="button"
              className="action-button is-danger"
              onClick={() => onDelete(link)}
              title="Delete"
              aria-label={`Delete ${link.name}`}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
