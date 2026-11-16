import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, ExternalLink, Flame, Inbox, LoaderCircle, MousePointerClick, PenLine, Plus, Send, Sparkles, Trash2, TriangleAlert, TrendingUp } from "lucide-react";
import { api, formatDate } from "../api.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { Toasts, useToastFromNavigation, useToasts } from "../components/Toasts.jsx";
import { formatNumber, formatShare } from "../components/charts/chartHelpers.js";

export const statusInfo = {
  draft: { label: "Draft", className: "" },
  sending: { label: "Sending…", className: "is-sending" },
  sent: { label: "Sent", className: "is-sent" },
  failed: { label: "Stopped", className: "is-failed" },
};

const starters = [
  { id: "blank", icon: PenLine, title: "Write your own", text: "A blank email for news, offers or anything else." },
  { id: "latest", icon: Sparkles, title: "Latest products", text: "Your newest finds, straight from the catalog." },
  { id: "hottest", icon: Flame, title: "Hottest this week", text: "The gifts people clicked most in the last 7 days." },
  { id: "trending", icon: TrendingUp, title: "Trending picks", text: "Everything you've marked as trending." },
];

export function EmailSetupBanner({ settings }) {
  if (!settings) return null;
  if (!settings.configured) {
    return (
      <div className="setup-banner is-warning">
        <TriangleAlert size={18} aria-hidden />
        <div>
          <strong>Email sending isn't set up yet.</strong> Add your Resend API key as <code>RESEND_API_KEY</code> and a sender on
          your verified domain as <code>EMAIL_FROM</code> in <code>backend/.env</code>, then restart the backend. You can still write and
          preview emails.
        </div>
      </div>
    );
  }
  if (settings.testInbox) {
    return (
      <div className="setup-banner">
        <Inbox size={18} aria-hidden />
        <div>
          <strong>Test mode.</strong> Emails are caught by Mailpit on this computer and don't reach real inboxes.{" "}
          <a href={settings.testInbox} target="_blank" rel="noreferrer">
            Open the test inbox <ExternalLink size={12} aria-hidden />
          </a>
          . To send for real, add your Resend API key as <code>RESEND_API_KEY</code> in <code>backend/.env</code> and restart the backend.
        </div>
      </div>
    );
  }
  return (
    <div className="setup-banner is-ready">
      <Send size={18} aria-hidden />
      <div>
        <strong>Sending with {settings.providerName}</strong> from <code>{settings.from}</code>. Emails go out in batches of 100.
      </div>
    </div>
  );
}

export default function EmailsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toasts, showToast, removeToast } = useToasts();
  useToastFromNavigation(showToast);

  async function loadCampaigns() {
    try {
      const data = await api("/campaigns");
      setCampaigns(data.campaigns);
      setLoadError("");
    } catch (problem) {
      setLoadError(problem.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
    api("/campaigns/settings")
      .then(setSettings)
      .catch(() => {});
  }, []);

  // Check progress every couple of seconds while an email is being sent.
  const anySending = campaigns.some((campaign) => campaign.status === "sending");
  useEffect(() => {
    if (!anySending) return;
    const timer = setInterval(loadCampaigns, 2000);
    return () => clearInterval(timer);
  }, [anySending]);

  async function duplicate(campaign) {
    try {
      const data = await api(`/campaigns/${campaign._id}/duplicate`, { method: "POST" });
      navigate(`/emails/${data.campaign._id}`, { state: { toast: "Copy made. Change anything you like, then send it." } });
    } catch (problem) {
      showToast(problem.message, "error");
    }
  }

  function askDelete(campaign) {
    setConfirm({
      title: `Delete "${campaign.subject}"?`,
      message: campaign.status === "sent" ? "It stays in people's inboxes. Only your copy and its stats are removed." : "The draft will be removed.",
      onConfirm: async () => {
        setBusy(true);
        try {
          await api(`/campaigns/${campaign._id}`, { method: "DELETE" });
          setCampaigns((list) => list.filter((item) => item._id !== campaign._id));
          showToast("Email deleted.");
          setConfirm(null);
        } catch (problem) {
          showToast(problem.message, "error");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  const sent = campaigns.filter((campaign) => campaign.status === "sent");
  const delivered = sent.reduce((sum, campaign) => sum + campaign.sentCount, 0);
  const clicks = campaigns.reduce((sum, campaign) => sum + campaign.clicks, 0);

  return (
    <div className="emails-page">
      <div className="page-header">
        <div>
          <h1>Emails</h1>
          <p className="muted page-subtitle">
            Send your latest and hottest finds to {settings ? `${formatNumber(settings.subscribers)} ${settings.subscribers === 1 ? "subscriber" : "subscribers"}` : "your subscribers"}.
          </p>
        </div>
        <Link to="/emails/new" className="button">
          <Plus size={16} aria-hidden /> New email
        </Link>
      </div>

      <EmailSetupBanner settings={settings} />
      {loadError && <p className="notice notice-error">{loadError}</p>}

      <div className="link-stats three">
        <div className="link-stat">
          <span className="link-stat-icon" aria-hidden>
            <Send size={18} />
          </span>
          <div>
            <p className="link-stat-value">{sent.length}</p>
            <p className="link-stat-label">Emails sent</p>
          </div>
        </div>
        <div className="link-stat">
          <span className="link-stat-icon" aria-hidden>
            <Inbox size={18} />
          </span>
          <div>
            <p className="link-stat-value">{formatNumber(delivered)}</p>
            <p className="link-stat-label">Emails delivered in total</p>
          </div>
        </div>
        <div className="link-stat">
          <span className="link-stat-icon" aria-hidden>
            <MousePointerClick size={18} />
          </span>
          <div>
            <p className="link-stat-value">{formatNumber(clicks)}</p>
            <p className="link-stat-label">Product clicks from emails</p>
          </div>
        </div>
      </div>

      <section className="starter-section" aria-labelledby="starter-title">
        <h2 id="starter-title">Start a new email</h2>
        <div className="starter-grid">
          {starters.map((starter) => (
            <Link key={starter.id} to={starter.id === "blank" ? "/emails/new" : `/emails/new?start=${starter.id}`} className="starter-card">
              <span className="starter-icon" aria-hidden>
                <starter.icon size={20} />
              </span>
              <strong>{starter.title}</strong>
              <span className="muted small">{starter.text}</span>
            </Link>
          ))}
        </div>
      </section>

      <h2 className="list-title">Your emails</h2>
      {loading ? (
        <div className="form-loading">
          <LoaderCircle size={20} className="spin" aria-hidden /> Loading emails…
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon" aria-hidden>
            <Send size={26} />
          </span>
          <h2>No emails yet</h2>
          <p className="muted">Pick a starting point above and you'll have an email ready in a minute.</p>
        </div>
      ) : (
        <ul className="campaign-list">
          {campaigns.map((campaign) => {
            const status = statusInfo[campaign.status];
            const progress = campaign.recipientCount ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.recipientCount) * 100) : 0;
            return (
              <li key={campaign._id} className="card campaign-item">
                <Link to={`/emails/${campaign._id}`} className="campaign-main">
                  <span className={`campaign-status ${status.className}`}>{status.label}</span>
                  <strong className="campaign-subject">{campaign.subject}</strong>
                  <span className="muted small">
                    {campaign.productCount} {campaign.productCount === 1 ? "product" : "products"} ·{" "}
                    {campaign.sentAt ? `Sent ${formatDate(campaign.sentAt)}` : `Edited ${formatDate(campaign.updatedAt)}`}
                  </span>
                  {campaign.status === "sending" && (
                    <span className="campaign-progress" aria-label={`${progress}% sent`}>
                      <span style={{ width: `${progress}%` }} />
                    </span>
                  )}
                </Link>
                <div className="campaign-numbers">
                  {campaign.status === "draft" ? (
                    <span className="muted small">Not sent yet</span>
                  ) : (
                    <>
                      <span>
                        <strong>{formatNumber(campaign.sentCount)}</strong>
                        <span className="muted small">delivered</span>
                      </span>
                      <span>
                        <strong>{formatNumber(campaign.clicks)}</strong>
                        <span className="muted small">clicks</span>
                      </span>
                      <span>
                        <strong>{campaign.sentCount ? formatShare(campaign.clicks, campaign.sentCount) : "—"}</strong>
                        <span className="muted small">click rate</span>
                      </span>
                    </>
                  )}
                </div>
                <div className="row-actions">
                  <button type="button" className="action-button" onClick={() => duplicate(campaign)} title="Duplicate" aria-label={`Duplicate ${campaign.subject}`}>
                    <Copy size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="action-button is-danger"
                    onClick={() => askDelete(campaign)}
                    disabled={campaign.status === "sending"}
                    title="Delete"
                    aria-label={`Delete ${campaign.subject}`}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => !busy && setConfirm(null)}
        busy={busy}
      />
      <Toasts toasts={toasts} onClose={removeToast} />
    </div>
  );
}
