import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FolderPlus,
  Info,
  Link2,
  Mail,
  MessageSquare,
  MousePointerClick,
  Package,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";
import { SITE_URL, api, downloadFile, formatDate } from "../api.js";
import Notice from "../components/Notice.jsx";
import StatTile from "../components/StatTile.jsx";
import ChartCard from "../components/charts/ChartCard.jsx";
import ColumnChart from "../components/charts/ColumnChart.jsx";
import RankedBars from "../components/charts/RankedBars.jsx";
import ShopSplit from "../components/charts/ShopSplit.jsx";
import { formatDay, formatNumber } from "../components/charts/chartHelpers.js";

const ranges = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];

const reasonLabels = {
  question: "Question",
  problem: "Problem",
  suggestion: "Gift idea",
  partnership: "Partnership",
};

const RANGE_KEY = "overview-range";

function readSavedRange() {
  try {
    const saved = Number(localStorage.getItem(RANGE_KEY));
    return ranges.some((range) => range.days === saved) ? saved : 30;
  } catch {
    return 30;
  }
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(value);
}

function plural(count, one, many) {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

function attentionItems(attention) {
  const items = [];
  if (attention.unreadMessages > 0) {
    items.push({ level: "warning", text: `${plural(attention.unreadMessages, "message", "messages")} waiting for a reply`, to: "/messages" });
  }
  if (attention.productsWithoutCategories > 0) {
    items.push({
      level: "warning",
      text: `${plural(attention.productsWithoutCategories, "live product has", "live products have")} no category, so filters can't find ${attention.productsWithoutCategories === 1 ? "it" : "them"}`,
      to: "/products?status=uncategorized",
    });
  }
  if (attention.samplePriceProducts > 0) {
    items.push({ level: "info", text: `${plural(attention.samplePriceProducts, "product still shows", "products still show")} a sample price`, to: "/products?status=sample" });
  }
  if (attention.hiddenProducts > 0) {
    items.push({ level: "info", text: `${plural(attention.hiddenProducts, "product is", "products are")} hidden from the site`, to: "/products?status=hidden" });
  }
  if (attention.emptyCategories.length > 0) {
    items.push({
      level: "info",
      text: `${plural(attention.emptyCategories.length, "category has", "categories have")} no products: ${attention.emptyCategories.slice(0, 3).join(", ")}${attention.emptyCategories.length > 3 ? "…" : ""}`,
      to: "/categories",
    });
  }
  if (attention.pausedLinks > 0) {
    items.push({ level: "info", text: `${plural(attention.pausedLinks, "referral link is", "referral links are")} paused`, to: "/referrals" });
  }
  return items;
}

function DailyTable({ rows, unit }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Day</th>
          <th className="right">{unit}</th>
        </tr>
      </thead>
      <tbody>
        {[...rows].reverse().map((row) => (
          <tr key={row.date}>
            <td>{formatDay(row.date, true)}</td>
            <td className="right tabular">{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function OverviewPage() {
  const [days, setDays] = useState(readSavedRange);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setLoading(true);
    api(`/stats?days=${days}&tz=${encodeURIComponent(timeZone)}`)
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        setError("");
      })
      .catch((loadError) => !cancelled && setError(loadError.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days, reloadCount]);

  function pickRange(value) {
    setDays(value);
    try {
      localStorage.setItem(RANGE_KEY, String(value));
    } catch {
      // The choice just won't be remembered next time.
    }
  }

  async function downloadSubscribers() {
    try {
      await downloadFile("/newsletter/export?status=subscribed", "newsletter-subscribers.csv");
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  const period = `previous ${days} days`;
  const rangeLabel = ranges.find((range) => range.days === days).label.toLowerCase();

  return (
    <div className="overview">
      <header className="overview-header">
        <div>
          <p className="overview-date">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1>{greeting()}</h1>
          <p className="muted">Here&apos;s how your gift site is doing.</p>
        </div>
        <div className="quick-actions">
          <Link to="/products/new" className="button">
            <Plus size={16} aria-hidden /> Add product
          </Link>
          <Link to="/emails/new" className="button button-light">
            <Send size={16} aria-hidden /> Email subscribers
          </Link>
          <Link to="/referrals" className="button button-light">
            <Link2 size={16} aria-hidden /> New referral link
          </Link>
          <Link to="/categories" className="button button-light">
            <FolderPlus size={16} aria-hidden /> Add category
          </Link>
          <button type="button" className="button button-light" onClick={downloadSubscribers}>
            <Download size={16} aria-hidden /> Subscribers CSV
          </button>
        </div>
      </header>

      <div className="overview-filters">
        <div className="range-picker" role="group" aria-label="Date range">
          {ranges.map((range) => (
            <button
              key={range.days}
              type="button"
              aria-pressed={days === range.days}
              className={days === range.days ? "is-selected" : ""}
              onClick={() => pickRange(range.days)}
            >
              {range.label}
            </button>
          ))}
        </div>
        <button type="button" className="icon-button" onClick={() => setReloadCount((count) => count + 1)} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} aria-hidden />
          <span>{loading ? "Updating…" : "Refresh"}</span>
        </button>
      </div>

      <Notice error={error} />

      {!stats ? (
        !error && <p className="muted">Loading…</p>
      ) : (
        <div className={`overview-body ${loading ? "is-refreshing" : ""}`}>
          <div className="stat-row">
            <StatTile
              icon={MousePointerClick}
              label="Referral clicks"
              value={stats.clicks.total}
              change={{ now: stats.clicks.total, before: stats.clicks.previous, period }}
              to="/referrals"
            />
            <StatTile
              icon={Mail}
              label="New subscribers"
              value={stats.subscribers.total}
              change={{ now: stats.subscribers.total, before: stats.subscribers.previous, period }}
              note={`${formatNumber(stats.totals.subscribers)} on the list in total`}
              to="/newsletter"
            />
            <StatTile
              icon={Package}
              label="Products on the site"
              value={stats.totals.activeProducts}
              note={`${stats.totals.products} in total · ${stats.totals.hiddenProducts} hidden · ${stats.totals.categories} categories`}
              to="/products"
            />
            <StatTile
              icon={MessageSquare}
              label="Unread messages"
              value={stats.totals.unreadMessages}
              note={stats.totals.unreadMessages > 0 ? "Reply from the Messages page" : "You're all caught up"}
              to="/messages"
            />
          </div>

          <div className="overview-grid">
            <ChartCard
              className="span-2"
              title="Referral clicks per day"
              subtitle={`Visitors sent to a shop, ${rangeLabel}`}
              table={<DailyTable rows={stats.clicks.daily} unit="Clicks" />}
            >
              <ColumnChart
                data={stats.clicks.daily}
                label={`Referral clicks per day, ${rangeLabel}`}
                unit={["click", "clicks"]}
                height={330}
                emptyText="No clicks yet in this period. Clicks show up here as soon as visitors use a “Check it out” button."
              />
            </ChartCard>

            <div className="side-stack">
              <ChartCard title="Clicks by shop" subtitle={`Where visitors went, ${rangeLabel}`}>
                <ShopSplit rows={stats.clicksByShop} />
              </ChartCard>
              <section className="card">
                <div className="chart-card-header">
                  <h2>Needs attention</h2>
                </div>
                <AttentionList items={attentionItems(stats.attention)} />
              </section>
            </div>

            <ChartCard
              title="Most clicked links"
              subtitle={rangeLabel}
              action={
                <Link to="/referrals" className="small">
                  All links
                </Link>
              }
            >
              {stats.topLinks.length === 0 ? (
                <p className="muted small chart-empty-inline">No clicks in this period yet.</p>
              ) : (
                <RankedBars
                  unit={["click", "clicks"]}
                  items={stats.topLinks.map((link) => ({
                    id: link.id,
                    label: link.name,
                    value: link.clicks,
                    image: link.image,
                    to: link.productId ? `/products/${link.productId}` : "/referrals",
                  }))}
                />
              )}
            </ChartCard>

            <ChartCard
              title="New subscribers per day"
              subtitle={`Newsletter sign-ups, ${rangeLabel}`}
              table={<DailyTable rows={stats.subscribers.daily} unit="Sign-ups" />}
            >
              <ColumnChart
                data={stats.subscribers.daily}
                label={`New newsletter subscribers per day, ${rangeLabel}`}
                unit={["sign-up", "sign-ups"]}
                height={200}
                emptyText="No new sign-ups in this period."
              />
            </ChartCard>

            <NewestSubscribers subscribers={stats.latestSubscribers} />
          </div>

          <div className="overview-grid lower">
            <section className="card span-3">
              <div className="chart-card-header">
                <h2>Latest messages</h2>
                <Link to="/messages" className="small">
                  All messages
                </Link>
              </div>
              {stats.latestMessages.length === 0 ? (
                <p className="muted small">No messages yet. They show up here when someone uses the contact form.</p>
              ) : (
                <ul className="activity-list">
                  {stats.latestMessages.map((message) => (
                    <li key={message._id} className={message.read ? "" : "is-unread"}>
                      <Link to={`/messages?id=${message._id}`} className="activity-item">
                        <span className="activity-avatar" aria-hidden>
                          {message.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="activity-text">
                          <span className="activity-title">
                            {message.name}
                            <span className="pill">{reasonLabels[message.reason] || message.reason}</span>
                            {!message.read && <span className="unread-label">New</span>}
                          </span>
                          <span className="activity-snippet">{message.message}</span>
                        </span>
                        <span className="activity-time">{timeAgo(message.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

          </div>

          <p className="overview-footnote muted small">
            Numbers use your time zone ({stats.range.timeZone}).{" "}
            <a href={SITE_URL} target="_blank" rel="noreferrer">
              Open the website ↗
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

function AttentionList({ items }) {
  if (items.length === 0) {
    return (
      <p className="attention-item">
        <CheckCircle2 size={18} className="status-good" aria-hidden />
        <span>Everything looks good. Nothing needs your attention.</span>
      </p>
    );
  }

  return (
    <ul className="attention-list">
      {items.map((item) => (
        <li key={item.text}>
          <Link to={item.to} className="attention-item">
            {item.level === "warning" ? (
              <AlertTriangle size={18} className="status-warning" aria-label="Needs action" />
            ) : (
              <Info size={18} className="status-info" aria-label="Good to know" />
            )}
            <span>{item.text}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NewestSubscribers({ subscribers }) {
  return (
    <section className="card">
      <div className="chart-card-header">
        <h2>Newest subscribers</h2>
        <Link to="/newsletter" className="small">
          See all
        </Link>
      </div>
      {subscribers.length === 0 ? (
        <p className="muted small">Nobody has signed up yet.</p>
      ) : (
        <ul className="activity-list compact">
          {subscribers.map((subscriber) => (
            <li key={subscriber._id} className="activity-item">
              <span className="activity-text">
                <span className="activity-title">{subscriber.email}</span>
                <span className="activity-snippet">from {subscriber.source}</span>
              </span>
              <span className="activity-time">{timeAgo(subscriber.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
