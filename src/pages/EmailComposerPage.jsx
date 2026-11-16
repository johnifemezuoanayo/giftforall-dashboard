import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Flame,
  LoaderCircle,
  Monitor,
  MousePointerClick,
  Plus,
  Search,
  Send,
  Smartphone,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { api, formatDate, thumbUrl } from "../api.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Drawer from "../components/Drawer.jsx";
import { Toasts, useToastFromNavigation, useToasts } from "../components/Toasts.jsx";
import { formatNumber, formatShare } from "../components/charts/chartHelpers.js";
import { EmailSetupBanner, statusInfo } from "./EmailsPage.jsx";

const MAX_PRODUCTS = 12;
const SUBJECT_TIP = 60;

const starters = {
  latest: {
    subject: "Fresh finds: new gifts we think you'll love",
    previewText: "Just added: our newest unusual gift ideas.",
    heading: "Just added to the shop",
    intro:
      "Hi there,\n\nWe've been busy hunting down clever, beautiful and slightly unexpected things. Here are the newest finds on the site. Have a look before everyone else does!",
  },
  hottest: {
    subject: "This week's most-loved gifts",
    previewText: "The finds everyone's clicking on right now.",
    heading: "What everyone's clicking on",
    intro: "Hi there,\n\nThese are the gifts our readers couldn't stop looking at this week. Popular for a reason, and still not the obvious choice.",
  },
  trending: {
    subject: "Trending now: gifts worth giving",
    previewText: "Our favourite picks of the moment.",
    heading: "Trending right now",
    intro: "Hi there,\n\nHere's what's hot on the site at the moment, from clever gadgets to cosy little luxuries. Perfect if you've got a birthday coming up.",
  },
};

const quickPicks = [
  { id: "latest", label: "Latest", icon: Sparkles, query: "type=latest" },
  { id: "hottest-7", label: "Hottest this week", icon: Flame, query: "type=hottest&days=7" },
  { id: "hottest-30", label: "Hottest this month", icon: Flame, query: "type=hottest&days=30" },
  { id: "trending", label: "Trending", icon: TrendingUp, query: "type=trending" },
];

const emptyForm = { subject: "", previewText: "", heading: "", intro: "Hi there,\n\n", products: [], buttonText: "See all gifts", buttonUrl: "" };

function snapshot(form) {
  return JSON.stringify({ ...form, products: form.products.map((product) => product._id) });
}

function formForSaving(form) {
  return { ...form, products: form.products.map((product) => product._id) };
}

function senderName(from) {
  const match = /^"?([^"<]+)"?\s*</.exec(from || "");
  return match ? match[1].trim() : from || "Your brand";
}

export default function EmailComposerPage() {
  const { id } = useParams();
  const isNew = !id;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot(emptyForm));
  const [campaign, setCampaign] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [allProducts, setAllProducts] = useState([]);
  const [pickerText, setPickerText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picking, setPicking] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewWidth, setPreviewWidth] = useState("desktop");
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [sending, setSending] = useState(false);
  const { toasts, showToast, removeToast } = useToasts();
  useToastFromNavigation(showToast);
  const startedRef = useRef(false);

  const isDraft = isNew || campaign?.status === "draft";
  const isDirty = snapshot(form) !== savedSnapshot;

  useEffect(() => {
    api("/campaigns/settings")
      .then((data) => {
        setSettings(data);
        setTestEmail(data.adminEmail || "");
      })
      .catch(() => {});
    api("/campaigns/picks")
      .then((data) => setAllProducts(data.products))
      .catch(() => {});
  }, []);

  async function loadCampaign() {
    const data = await api(`/campaigns/${id}`);
    const loaded = {
      subject: data.campaign.subject,
      previewText: data.campaign.previewText,
      heading: data.campaign.heading,
      intro: data.campaign.intro,
      products: data.campaign.productDetails,
      buttonText: data.campaign.buttonText,
      buttonUrl: data.campaign.buttonUrl,
    };
    setCampaign(data.campaign);
    setForm(loaded);
    setSavedSnapshot(snapshot(loaded));
    return data.campaign;
  }

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    loadCampaign()
      .catch((problem) => setLoadError(problem.message))
      .finally(() => setLoading(false));
  }, [id]);

  // A new email can start from "latest", "hottest" or "trending", which fills in the text and products.
  useEffect(() => {
    if (!isNew || startedRef.current) return;
    startedRef.current = true;
    const start = searchParams.get("start");
    if (!starters[start]) return;
    const filled = { ...emptyForm, ...starters[start] };
    setForm(filled);
    setSavedSnapshot(snapshot(emptyForm));
    applyQuickPick(start === "hottest" ? "hottest-7" : start, filled);
  }, [isNew]);

  // Keep checking progress while the email is being sent.
  useEffect(() => {
    if (campaign?.status !== "sending") return;
    const timer = setInterval(() => {
      loadCampaign().catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [campaign?.status]);

  // Rebuild the preview shortly after the person stops typing.
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const data = await api("/campaigns/preview", { method: "POST", body: formForSaving(form) });
        setPreviewHtml(data.html);
      } catch {
        // The old preview stays until the next change.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [form]);

  useEffect(() => {
    if (!isDirty || !isDraft) return;
    const warn = (event) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty, isDraft]);

  function update(changes) {
    setForm((current) => ({ ...current, ...changes }));
    if (changes.subject !== undefined && changes.subject.trim()) setErrors((current) => ({ ...current, subject: undefined }));
    if (changes.products?.length) setErrors((current) => ({ ...current, products: undefined }));
  }

  async function applyQuickPick(pickId, baseForm) {
    const pick = quickPicks.find((item) => item.id === pickId);
    if (!pick) return;
    setPicking(pickId);
    try {
      const data = await api(`/campaigns/picks?${pick.query}&limit=6`);
      if (data.products.length === 0) {
        showToast(
          pickId.startsWith("hottest")
            ? `No product clicks in the last ${data.days} days yet. Try "${pickId === "hottest-7" ? "Hottest this month" : "Latest"}" instead.`
            : "No products found for this pick.",
          "error",
        );
        return;
      }
      setForm((current) => ({ ...(baseForm || current), products: data.products }));
      setErrors((current) => ({ ...current, products: undefined }));
      if (!baseForm) showToast(`Added ${data.products.length} ${pick.label.toLowerCase()} products.`);
    } catch (problem) {
      showToast(problem.message, "error");
    } finally {
      setPicking("");
    }
  }

  function addProduct(product) {
    if (form.products.length >= MAX_PRODUCTS) {
      showToast(`An email can show up to ${MAX_PRODUCTS} products.`, "error");
      return;
    }
    update({ products: [...form.products, product] });
    setPickerText("");
    setPickerOpen(false);
  }

  function moveProduct(index, step) {
    const list = [...form.products];
    const [item] = list.splice(index, 1);
    list.splice(index + step, 0, item);
    update({ products: list });
  }

  function removeProduct(index) {
    update({ products: form.products.filter((_, position) => position !== index) });
  }

  // Saves the draft and returns its id, so sending and testing always use the latest text.
  async function saveDraft({ quiet = false } = {}) {
    if (!form.subject.trim()) {
      setErrors((current) => ({ ...current, subject: "Write a subject line." }));
      document.getElementById("email-subject")?.focus();
      showToast("Write a subject line first.", "error");
      return null;
    }
    setSaving(true);
    try {
      if (isNew) {
        const data = await api("/campaigns", { method: "POST", body: formForSaving(form) });
        setSavedSnapshot(snapshot(form));
        navigate(`/emails/${data.campaign._id}`, { replace: true, state: quiet ? undefined : { toast: "Draft saved." } });
        return data.campaign._id;
      }
      await api(`/campaigns/${id}`, { method: "PUT", body: formForSaving(form) });
      setSavedSnapshot(snapshot(form));
      if (!quiet) showToast("Draft saved.");
      return id;
    } catch (problem) {
      showToast(problem.message, "error");
      return null;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function saveShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (isDraft) saveDraft();
      }
    }
    window.addEventListener("keydown", saveShortcut);
    return () => window.removeEventListener("keydown", saveShortcut);
  });

  async function sendTest(event) {
    event.preventDefault();
    const campaignId = isDirty || isNew ? await saveDraft({ quiet: true }) : id;
    if (!campaignId) return;
    setTesting(true);
    try {
      const data = await api(`/campaigns/${campaignId}/test`, { method: "POST", body: { email: testEmail } });
      showToast(data.message);
      setTestOpen(false);
    } catch (problem) {
      showToast(problem.message, "error");
    } finally {
      setTesting(false);
    }
  }

  function askSend() {
    const problems = {};
    if (!form.subject.trim()) problems.subject = "Write a subject line.";
    if (form.products.length === 0 && !form.intro.trim()) problems.products = "Add some products or write a message.";
    setErrors(problems);
    if (Object.keys(problems).length > 0) {
      showToast(Object.values(problems).join(" "), "error");
      return;
    }
    const count = settings?.subscribers ?? 0;
    setConfirm({
      title: `Send to ${formatNumber(count)} ${count === 1 ? "subscriber" : "subscribers"}?`,
      message: `"${form.subject}"${form.products.length ? ` with ${form.products.length} ${form.products.length === 1 ? "product" : "products"}` : ""} goes out now${settings?.providerName ? ` through ${settings.providerName}` : ""}. Once it's sent, it can't be changed or called back.`,
    });
  }

  async function sendNow() {
    setSending(true);
    try {
      const campaignId = isDirty || isNew ? await saveDraft({ quiet: true }) : id;
      if (!campaignId) return;
      const data = await api(`/campaigns/${campaignId}/send`, { method: "POST" });
      setConfirm(null);
      if (isNew) {
        navigate(`/emails/${campaignId}`, { replace: true, state: { toast: data.message } });
      } else {
        showToast(data.message);
        await loadCampaign();
      }
    } catch (problem) {
      showToast(problem.message, "error");
      setConfirm(null);
    } finally {
      setSending(false);
    }
  }

  async function duplicate() {
    try {
      const data = await api(`/campaigns/${id}/duplicate`, { method: "POST" });
      navigate(`/emails/${data.campaign._id}`, { state: { toast: "Copy made. Change anything you like, then send it." } });
    } catch (problem) {
      showToast(problem.message, "error");
    }
  }

  if (loading) {
    return (
      <div className="form-loading">
        <LoaderCircle size={22} className="spin" aria-hidden /> Loading email…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card empty-state">
        <h2>Couldn't open this email</h2>
        <p className="muted">{loadError}</p>
        <Link to="/emails" className="button button-light">
          Back to emails
        </Link>
      </div>
    );
  }

  const selectedIds = new Set(form.products.map((product) => product._id));
  const pickerMatches = allProducts
    .filter((product) => !selectedIds.has(product._id))
    .filter((product) => product.name.toLowerCase().includes(pickerText.trim().toLowerCase()))
    .slice(0, 8);
  const status = campaign ? statusInfo[campaign.status] : statusInfo.draft;
  const canSend = settings?.configured && settings.subscribers > 0;

  return (
    <div className="product-form-page email-composer">
      <header className="form-topbar">
        <div className="form-topbar-title">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/emails" className="text-button">
              Emails
            </Link>
            <ChevronRight size={14} aria-hidden />
            <span aria-current="page">{isNew ? "New email" : isDraft ? "Draft" : "Sent email"}</span>
          </nav>
          <h1>
            {form.subject || "New email"}
            <span className={`campaign-status ${status.className}`}>{status.label}</span>
          </h1>
        </div>
        <div className="form-topbar-actions">
          {isDraft ? (
            <>
              {isDirty && (
                <span className="unsaved-note">
                  <span className="unsaved-dot" aria-hidden /> Unsaved changes
                </span>
              )}
              <button type="button" className="button button-light" onClick={() => saveDraft()} disabled={saving || (!isNew && !isDirty)}>
                {saving ? "Saving…" : "Save draft"}
              </button>
              <button type="button" className="button button-light" onClick={() => setTestOpen(true)} disabled={!settings?.configured}>
                Send test
              </button>
              <button
                type="button"
                className="button"
                onClick={askSend}
                disabled={!canSend || sending}
                title={!settings?.configured ? "Email sending isn't set up yet" : settings?.subscribers === 0 ? "Nobody is subscribed yet" : undefined}
              >
                <Send size={16} aria-hidden /> Send to {formatNumber(settings?.subscribers ?? 0)} {settings?.subscribers === 1 ? "subscriber" : "subscribers"}
              </button>
            </>
          ) : (
            <button type="button" className="button button-light" onClick={duplicate}>
              <Copy size={16} aria-hidden /> Duplicate
            </button>
          )}
        </div>
      </header>

      <EmailSetupBanner settings={settings} />

      {!isDraft && campaign && <SendResults campaign={campaign} />}

      <div className="product-form-layout composer-layout">
        <div className="form-main">
          {isDraft ? (
            <>
              <section className="card form-section">
                <div className="section-heading">
                  <h2>The email</h2>
                  <p className="muted small">What people see in their inbox, and the words at the top of the email.</p>
                </div>

                <div className={`form-field ${errors.subject ? "has-error" : ""}`}>
                  <div className="field-title-row">
                    <label htmlFor="email-subject" className="field-title">
                      Subject line <span className="required">*</span>
                    </label>
                    <span className={`char-count ${form.subject.length > SUBJECT_TIP ? "is-over" : ""}`}>
                      {form.subject.length}/{SUBJECT_TIP}
                    </span>
                  </div>
                  <input
                    id="email-subject"
                    value={form.subject}
                    onChange={(event) => update({ subject: event.target.value })}
                    placeholder="e.g. 6 new gifts we can't stop talking about"
                    maxLength={150}
                  />
                  {errors.subject ? (
                    <p className="field-error">{errors.subject}</p>
                  ) : (
                    form.subject.length > SUBJECT_TIP && <p className="field-hint">Phones cut off long subjects, so shorter works better.</p>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="email-preview-text" className="field-title">
                    Preview text <span className="optional">shown after the subject in most inboxes</span>
                  </label>
                  <input
                    id="email-preview-text"
                    value={form.previewText}
                    onChange={(event) => update({ previewText: event.target.value })}
                    placeholder="A short teaser, like “Our newest finds, picked for you.”"
                    maxLength={200}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="email-heading" className="field-title">
                    Heading <span className="optional">uses the subject if empty</span>
                  </label>
                  <input
                    id="email-heading"
                    value={form.heading}
                    onChange={(event) => update({ heading: event.target.value })}
                    placeholder={form.subject || "Big title at the top of the email"}
                    maxLength={150}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="email-intro" className="field-title">
                    Message
                  </label>
                  <textarea
                    id="email-intro"
                    rows={6}
                    value={form.intro}
                    onChange={(event) => update({ intro: event.target.value })}
                    placeholder="A friendly note before the products. Leave an empty line between paragraphs."
                  />
                </div>
              </section>

              <section className={`card form-section ${errors.products ? "has-error-section" : ""}`}>
                <div className="section-heading">
                  <h2>Products</h2>
                  <p className="muted small">
                    Pick a ready-made list or add products one by one. Up to {MAX_PRODUCTS}, shown two per row. Optional if you've written a message.
                  </p>
                </div>

                <div className="quick-picks" role="group" aria-label="Fill with products">
                  {quickPicks.map((pick) => (
                    <button key={pick.id} type="button" className="choice-chip" onClick={() => applyQuickPick(pick.id)} disabled={Boolean(picking)}>
                      {picking === pick.id ? <LoaderCircle size={14} className="spin" aria-hidden /> : <pick.icon size={14} aria-hidden />}
                      {pick.label}
                    </button>
                  ))}
                </div>
                <p className="field-hint quick-pick-hint">Picking a list replaces the products below.</p>

                {form.products.length === 0 ? (
                  <div className="products-empty">No products yet. Pick a list above or add one below.</div>
                ) : (
                  <ol className="email-products">
                    {form.products.map((product, index) => (
                      <li key={product._id} className="email-product">
                        <span className="email-product-number">{index + 1}</span>
                        <img src={thumbUrl(product.image?.src)} alt="" className="product-thumb small" />
                        <div className="email-product-text">
                          <strong>{product.name}</strong>
                          <span className="muted small">
                            ${Number(product.price?.amount || 0).toFixed(2)} · {product.retailer === "temu" ? "Temu" : "Amazon"}
                            {product.clicks ? (
                              <span className="clicks-pill">
                                <MousePointerClick size={11} aria-hidden /> {product.clicks} clicks
                              </span>
                            ) : null}
                            {product.active === false && <span className="hidden-pill">Hidden, won't be sent</span>}
                          </span>
                        </div>
                        <div className="row-actions">
                          <button type="button" className="action-button" onClick={() => moveProduct(index, -1)} disabled={index === 0} aria-label={`Move ${product.name} up`} title="Move up">
                            <ArrowUp size={15} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="action-button"
                            onClick={() => moveProduct(index, 1)}
                            disabled={index === form.products.length - 1}
                            aria-label={`Move ${product.name} down`}
                            title="Move down"
                          >
                            <ArrowDown size={15} aria-hidden />
                          </button>
                          <button type="button" className="action-button is-danger" onClick={() => removeProduct(index)} aria-label={`Remove ${product.name}`} title="Remove">
                            <X size={15} aria-hidden />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {errors.products && <p className="field-error">{errors.products}</p>}

                <div className="product-picker">
                  <label className="search-field">
                    <Plus size={16} aria-hidden />
                    <span className="sr-only">Add a product</span>
                    <input
                      type="search"
                      value={pickerText}
                      onChange={(event) => {
                        setPickerText(event.target.value);
                        setPickerOpen(true);
                      }}
                      onFocus={() => setPickerOpen(true)}
                      onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
                      placeholder={form.products.length >= MAX_PRODUCTS ? "This email is full" : "Add a product by name…"}
                      disabled={form.products.length >= MAX_PRODUCTS}
                    />
                    <Search size={15} aria-hidden />
                  </label>
                  {pickerOpen && pickerMatches.length > 0 && (
                    <ul className="picker-results" role="listbox">
                      {pickerMatches.map((product) => (
                        <li key={product._id}>
                          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addProduct(product)}>
                            <img src={thumbUrl(product.image?.src)} alt="" />
                            <span>{product.name}</span>
                            <span className="muted small">${Number(product.price.amount).toFixed(2)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <section className="card form-section">
                <div className="section-heading">
                  <h2>Button at the end</h2>
                  <p className="muted small">Sends readers to your website for more ideas.</p>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="email-button-text" className="field-title">
                      Button text
                    </label>
                    <input id="email-button-text" value={form.buttonText} onChange={(event) => update({ buttonText: event.target.value })} maxLength={40} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="email-button-url" className="field-title">
                      Button link <span className="optional">your homepage if empty</span>
                    </label>
                    <input
                      id="email-button-url"
                      type="url"
                      value={form.buttonUrl}
                      onChange={(event) => update({ buttonUrl: event.target.value.trim() })}
                      placeholder="https://yoursite.com/discover/new"
                    />
                  </div>
                </div>
              </section>
            </>
          ) : (
            <section className="card form-section">
              <div className="section-heading">
                <h2>What was sent</h2>
              </div>
              <dl className="sent-details">
                <dt>Subject</dt>
                <dd>{form.subject}</dd>
                {form.previewText && (
                  <>
                    <dt>Preview text</dt>
                    <dd>{form.previewText}</dd>
                  </>
                )}
                <dt>Products</dt>
                <dd>{form.products.map((product) => product.name).join(", ")}</dd>
                <dt>Sent</dt>
                <dd>{campaign.sentAt ? formatDate(campaign.sentAt) : campaign.startedAt ? `Started ${formatDate(campaign.startedAt)}` : "—"}</dd>
              </dl>
            </section>
          )}
        </div>

        <aside className="form-side email-preview-side">
          <section className="card side-card">
            <div className="side-card-heading">
              <h2>Inbox preview</h2>
            </div>
            <div className="inbox-row-preview">
              <span className="person-avatar" aria-hidden>
                {senderName(settings?.from).charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{senderName(settings?.from)}</strong>
                <p>
                  <span className="inbox-subject">{form.subject || "Your subject line"}</span>
                  <span className="muted"> — {form.previewText || "Your preview text"}</span>
                </p>
              </div>
            </div>
          </section>

          <section className="card side-card email-preview-card">
            <div className="side-card-heading">
              <h2>Email preview</h2>
              <div className="view-toggle" role="group" aria-label="Preview size">
                <button type="button" aria-pressed={previewWidth === "desktop"} onClick={() => setPreviewWidth("desktop")} title="Computer">
                  <Monitor size={15} aria-hidden />
                  <span className="sr-only">Computer</span>
                </button>
                <button type="button" aria-pressed={previewWidth === "phone"} onClick={() => setPreviewWidth("phone")} title="Phone">
                  <Smartphone size={15} aria-hidden />
                  <span className="sr-only">Phone</span>
                </button>
              </div>
            </div>
            <div className={`email-frame-wrap is-${previewWidth}`}>
              {previewHtml ? (
                <iframe title="Email preview" srcDoc={previewHtml} sandbox="" className="email-frame" />
              ) : (
                <div className="form-loading">
                  <LoaderCircle size={18} className="spin" aria-hidden /> Building preview…
                </div>
              )}
            </div>
            <p className="field-hint">Links are switched off in this preview. Send a test to try them.</p>
          </section>
        </aside>
      </div>

      <Drawer
        open={testOpen}
        onClose={() => !testing && setTestOpen(false)}
        title="Send a test email"
        subtitle="See exactly what subscribers will get, before you send it to everyone."
        footer={
          <>
            <button type="button" className="button button-light" onClick={() => setTestOpen(false)} disabled={testing}>
              Cancel
            </button>
            <button type="submit" form="test-email-form" className="button" disabled={testing}>
              {testing ? <LoaderCircle size={16} className="spin" aria-hidden /> : <Send size={16} aria-hidden />}
              {testing ? "Sending…" : "Send test"}
            </button>
          </>
        }
      >
        <form id="test-email-form" onSubmit={sendTest} className="product-form-page">
          <div className="form-field">
            <label htmlFor="test-email" className="field-title">
              Send the test to
            </label>
            <input id="test-email" type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} required />
            <p className="field-hint">The subject starts with “[Test]”. Clicks on test emails don't count toward this email's stats.</p>
          </div>
          {settings?.testInbox && (
            <a href={settings.testInbox} target="_blank" rel="noreferrer" className="button button-light">
              <ExternalLink size={15} aria-hidden /> Open the test inbox
            </a>
          )}
        </form>
      </Drawer>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Send now"
        onConfirm={sendNow}
        onCancel={() => !sending && setConfirm(null)}
        busy={sending}
      />
      <Toasts toasts={toasts} onClose={removeToast} />
    </div>
  );
}

function SendResults({ campaign }) {
  const done = campaign.sentCount + campaign.failedCount;
  const progress = campaign.recipientCount ? Math.round((done / campaign.recipientCount) * 100) : 0;

  return (
    <section className="card send-results">
      {campaign.status === "sending" && (
        <div className="send-progress">
          <div className="send-progress-top">
            <strong>
              <LoaderCircle size={16} className="spin" aria-hidden /> Sending… {formatNumber(done)} of {formatNumber(campaign.recipientCount)}
            </strong>
            <span className="muted small">{progress}%</span>
          </div>
          <span className="campaign-progress">
            <span style={{ width: `${progress}%` }} />
          </span>
          <p className="muted small">You can leave this page. Sending carries on in the background.</p>
        </div>
      )}
      {campaign.error && (
        <p className="notice notice-error">
          <TriangleAlert size={15} aria-hidden /> {campaign.error}
        </p>
      )}
      <div className="result-numbers">
        <div>
          <Users size={18} aria-hidden />
          <strong>{formatNumber(campaign.recipientCount)}</strong>
          <span className="muted small">people on the list</span>
        </div>
        <div>
          <Check size={18} aria-hidden />
          <strong>{formatNumber(campaign.sentCount)}</strong>
          <span className="muted small">delivered to their email provider</span>
        </div>
        <div>
          <TriangleAlert size={18} aria-hidden />
          <strong>{formatNumber(campaign.failedCount)}</strong>
          <span className="muted small">couldn't be sent</span>
        </div>
        <div>
          <MousePointerClick size={18} aria-hidden />
          <strong>{formatNumber(campaign.clicks)}</strong>
          <span className="muted small">product clicks{campaign.sentCount ? ` · ${formatShare(campaign.clicks, campaign.sentCount)} click rate` : ""}</span>
        </div>
      </div>
      {campaign.failedEmails?.length > 0 && (
        <details className="failed-list">
          <summary>See who didn't get it</summary>
          <ul>
            {campaign.failedEmails.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
