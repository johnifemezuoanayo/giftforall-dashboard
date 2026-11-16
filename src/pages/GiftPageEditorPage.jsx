import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Braces,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Flame,
  LoaderCircle,
  Package,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { SITE_URL, api, sizedImageUrl, thumbUrl } from "../api.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Drawer from "../components/Drawer.jsx";
import MediaInput from "../components/MediaInput.jsx";
import Switch from "../components/Switch.jsx";
import { Toasts, useToastFromNavigation, useToasts } from "../components/Toasts.jsx";
import { audienceOptions, introToText, pagePath, sectionOptions, textToIntro } from "../components/giftPages.js";

const priceIdeas = [25, 50, 100];
const sortOptions = [
  { id: "", label: "Site order" },
  { id: "featured", label: "Badges first" },
  { id: "newest", label: "Newest first" },
];

function thisMonth() {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const emptyForm = {
  section: "gifts",
  slug: "",
  label: "",
  title: "",
  tagline: "",
  about: "",
  rule: { audiences: [], interests: [], maxPrice: "", trending: false, ids: [], sort: "" },
  interests: [],
  related: [],
  guideId: "",
  feature: { headline: "", highlight: "", updated: thisMonth(), image: { src: "", alt: "" } },
  introText: "",
  metaTitle: "",
  gridTitle: "",
  picksTitle: "",
};

function fromPage(page) {
  const rule = page.rule || {};
  return {
    section: page.section || "gifts",
    slug: page.slug || "",
    label: page.label || "",
    title: page.title || "",
    tagline: page.tagline || "",
    about: page.about || "",
    rule: {
      audiences: rule.audiences || [],
      interests: rule.interests || [],
      maxPrice: rule.maxPrice ?? "",
      trending: Boolean(rule.trending),
      ids: rule.ids || [],
      sort: rule.sort || "",
    },
    interests: page.interests || [],
    related: page.related || [],
    guideId: page.guideId || "",
    feature: {
      headline: page.feature?.headline || "",
      highlight: page.feature?.highlight || "",
      updated: page.feature?.updated || "",
      image: { src: page.feature?.image?.src || "", alt: page.feature?.image?.alt || "" },
    },
    introText: introToText(page.feature?.intro || []),
    metaTitle: page.metaTitle || "",
    gridTitle: page.gridTitle || "",
    picksTitle: page.picksTitle || "",
  };
}

function toPayload(form) {
  const { introText, ...rest } = form;
  return { ...rest, feature: { ...form.feature, intro: textToIntro(introText) } };
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function checkForm(form, isNew) {
  const errors = {};
  if (!form.label.trim()) errors.label = "Give the page a short menu name, like “Dad”.";
  if (isNew && !form.slug.trim()) errors.slug = "Pick a link name, like “for-dad”.";
  if (!form.title.trim()) errors.title = "Give the page a title, like “gifts for dad”.";
  if (!form.feature.headline.trim()) errors.headline = "Write a headline for the top of the page.";
  if (!form.feature.image.src) errors.image = "Add a header photo. The page can't show without one.";
  return errors;
}

const fieldOrder = ["label", "slug", "title", "headline", "image"];

function Headline({ text, highlight }) {
  const start = highlight ? text.indexOf(highlight) : -1;
  if (start === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, start)}
      <mark className="headline-mark">{highlight}</mark>
      {text.slice(start + highlight.length)}
    </>
  );
}

export default function GiftPageEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(emptyForm));
  const [slugEdited, setSlugEdited] = useState(!isNew);
  const [allPages, setAllPages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [articles, setArticles] = useState([]);
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [triedToSave, setTriedToSave] = useState(false);
  const [pickerText, setPickerText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toasts, showToast, removeToast } = useToasts();
  useToastFromNavigation(showToast);
  const formRef = useRef(null);

  const isDirty = JSON.stringify(form) !== savedSnapshot;
  const handPicked = form.rule.ids.length > 0;

  useEffect(() => {
    api("/pages")
      .then((data) => setAllPages(data.pages))
      .catch(() => {});
    api("/categories")
      .then((data) => setCategories(data.categories))
      .catch(() => {});
    api("/products")
      .then((data) => setProducts(data.products.filter((product) => product.active)))
      .catch(() => {});
    api("/content")
      .then((data) => setArticles(data.items.find((item) => item.key === "articles")?.value || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    api(`/pages/${id}`)
      .then((data) => {
        const loaded = fromPage(data.page);
        setForm(loaded);
        setSavedSnapshot(JSON.stringify(loaded));
      })
      .catch((problem) => setLoadError(problem.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // Count the products the rule picks, shortly after it changes.
  const ruleKey = JSON.stringify(form.rule);
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setMatch(await api("/pages/match", { method: "POST", body: { rule: form.rule } }));
      } catch {
        setMatch(null);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [ruleKey]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  useEffect(() => {
    function saveShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", saveShortcut);
    return () => window.removeEventListener("keydown", saveShortcut);
  }, []);

  const categoryNames = useMemo(() => Object.fromEntries(categories.map((item) => [item.slug, item.label])), [categories]);

  function update(changes) {
    setForm((current) => {
      const next = { ...current, ...changes };
      if (triedToSave) setErrors(checkForm(next, isNew));
      return next;
    });
  }

  function updateRule(changes) {
    update({ rule: { ...form.rule, ...changes } });
  }

  function updateFeature(changes) {
    update({ feature: { ...form.feature, ...changes } });
  }

  function toggle(list, value) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setTriedToSave(true);
    const found = checkForm(form, isNew);
    setErrors(found);
    const first = fieldOrder.find((field) => found[field]);
    if (first) {
      const element = document.getElementById(`page-${first}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.focus({ preventScroll: true });
      showToast("Please fix the highlighted fields.", "error");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const data = await api("/pages", { method: "POST", body: toPayload(form) });
        setSavedSnapshot(JSON.stringify(form));
        navigate(`/pages/${data.page._id}`, { state: { toast: `"${data.page.label}" page created.` } });
      } else {
        const data = await api(`/pages/${id}`, { method: "PUT", body: toPayload(form) });
        const saved = fromPage(data.page);
        setForm(saved);
        setSavedSnapshot(JSON.stringify(saved));
        showToast("Page saved. The website updates in a moment.");
      }
    } catch (problem) {
      showToast(problem.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function leavePage() {
    if (!isDirty) return navigate("/pages");
    setConfirm({
      title: "Leave without saving?",
      message: "You have changes that haven't been saved. They'll be lost if you leave now.",
      confirmLabel: "Leave page",
      onConfirm: () => {
        setSavedSnapshot(JSON.stringify(form));
        navigate("/pages");
      },
    });
  }

  function askDelete() {
    setConfirm({
      title: `Delete the "${form.label}" page?`,
      message: form.slug
        ? `${pagePath(form)} will stop working, and menus or links pointing to it will lead nowhere.`
        : `This is the main page of ${sectionOptions.find((item) => item.id === form.section)?.label}. Deleting it breaks ${pagePath(form)}.`,
      confirmLabel: "Delete page",
      onConfirm: async () => {
        setBusy(true);
        try {
          await api(`/pages/${id}`, { method: "DELETE" });
          setSavedSnapshot(JSON.stringify(form));
          navigate("/pages", { state: { toast: `"${form.label}" page deleted.` } });
        } catch (problem) {
          showToast(problem.message, "error");
          setBusy(false);
          setConfirm(null);
        }
      },
    });
  }

  function openJson() {
    setJsonText(JSON.stringify(toPayload(form), null, 2));
    setJsonError("");
    setJsonOpen(true);
  }

  function applyJson() {
    try {
      setForm(fromPage(JSON.parse(jsonText)));
      setJsonOpen(false);
      showToast("JSON applied. Save the page to keep it.");
    } catch {
      setJsonError("That isn't valid JSON. Check for missing commas or quotes.");
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}${pagePath(form)}`);
      showToast("Page address copied.");
    } catch {
      showToast("Could not copy. Please copy the address by hand.", "error");
    }
  }

  if (loading) {
    return (
      <div className="form-loading">
        <LoaderCircle size={22} className="spin" aria-hidden /> Loading page…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card empty-state">
        <h2>Couldn't open this page</h2>
        <p className="muted">{loadError}</p>
        <Link to="/pages" className="button button-light">
          Back to gift pages
        </Link>
      </div>
    );
  }

  const fieldClass = (name) => (errors[name] ? "has-error" : "");
  const sectionPages = allPages.filter((page) => page.section === form.section && page.slug && page.slug !== form.slug);
  const pickedProducts = form.rule.ids.map((slug) => products.find((product) => product.slug === slug) || { slug, name: slug, missing: true });
  const pickerMatches = products
    .filter((product) => !form.rule.ids.includes(product.slug))
    .filter((product) => product.name.toLowerCase().includes(pickerText.trim().toLowerCase()))
    .slice(0, 8);
  const highlightMissing = form.feature.highlight && !form.feature.headline.includes(form.feature.highlight);
  const introParts = textToIntro(form.introText);
  const address = pagePath(form);

  return (
    <form ref={formRef} className="product-form-page gift-page-editor" onSubmit={handleSubmit} noValidate>
      <header className="form-topbar">
        <div className="form-topbar-title">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <button type="button" className="text-button" onClick={leavePage}>
              Gift pages
            </button>
            <ChevronRight size={14} aria-hidden />
            <span aria-current="page">{isNew ? "New page" : "Edit"}</span>
          </nav>
          <h1>
            {isNew ? "New gift page" : form.label || "Untitled page"}
            <code className="topbar-path">{address}</code>
          </h1>
        </div>
        <div className="form-topbar-actions">
          {isDirty && (
            <span className="unsaved-note">
              <span className="unsaved-dot" aria-hidden /> Unsaved changes
            </span>
          )}
          <button type="button" className="button button-light" onClick={openJson} title="Edit everything as JSON">
            <Braces size={15} aria-hidden /> JSON
          </button>
          <button type="button" className="button button-light" onClick={leavePage}>
            Cancel
          </button>
          <button type="submit" className="button" disabled={saving || (!isNew && !isDirty)} title="Save (Ctrl + S)">
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden /> : <Check size={16} aria-hidden />}
            {saving ? "Saving…" : isNew ? "Create page" : "Save page"}
          </button>
        </div>
      </header>

      <div className="product-form-layout">
        <div className="form-main">
          <section className="card form-section">
            <div className="section-heading">
              <h2>Page basics</h2>
              <p className="muted small">Where the page lives and what it's called in menus and headings.</p>
            </div>

            <div className="form-field">
              <span className="field-title" id="section-label">
                Part of the site
              </span>
              <div className="segmented wrap" role="radiogroup" aria-labelledby="section-label">
                {sectionOptions.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    role="radio"
                    aria-checked={form.section === section.id}
                    className={form.section === section.id ? "is-selected" : ""}
                    onClick={() => update({ section: section.id, related: [] })}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className={`form-field ${fieldClass("label")}`}>
                <label htmlFor="page-label" className="field-title">
                  Menu name <span className="required">*</span>
                </label>
                <input
                  id="page-label"
                  value={form.label}
                  onChange={(event) =>
                    update(slugEdited ? { label: event.target.value } : { label: event.target.value, slug: slugify(`for ${event.target.value}`) })
                  }
                  placeholder="e.g. Dad"
                  maxLength={60}
                />
                {errors.label && <p className="field-error">{errors.label}</p>}
              </div>
              <div className={`form-field ${fieldClass("slug")}`}>
                <label htmlFor="page-slug" className="field-title">
                  Link name {isNew && <span className="required">*</span>}
                </label>
                <div className="input-with-prefix">
                  <span className="input-prefix">{sectionOptions.find((item) => item.id === form.section)?.basePath}/</span>
                  <input
                    id="page-slug"
                    value={form.slug}
                    onChange={(event) => {
                      setSlugEdited(true);
                      update({ slug: event.target.value });
                    }}
                    onBlur={() => update({ slug: slugify(form.slug) })}
                    placeholder={isNew ? "for-dad" : "(main page of this section)"}
                  />
                </div>
                {errors.slug ? <p className="field-error">{errors.slug}</p> : !isNew && <p className="field-hint">Changing it breaks old links to this page.</p>}
              </div>
            </div>

            <div className={`form-field ${fieldClass("title")}`}>
              <label htmlFor="page-title" className="field-title">
                Title <span className="required">*</span>
              </label>
              <input id="page-title" value={form.title} onChange={(event) => update({ title: event.target.value })} placeholder="e.g. gifts for dad" maxLength={80} />
              {errors.title ? (
                <p className="field-error">{errors.title}</p>
              ) : (
                <p className="field-hint">Used in headings like “all {form.title || "gifts for dad"}” and “how we pick {form.title || "gifts for dad"}”.</p>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="page-tagline" className="field-title">
                Tagline
              </label>
              <input
                id="page-tagline"
                value={form.tagline}
                onChange={(event) => update({ tagline: event.target.value })}
                placeholder="e.g. For the dad who says he doesn't need anything."
                maxLength={160}
              />
            </div>

            <div className="form-field">
              <label htmlFor="page-about" className="field-title">
                How we pick these gifts
              </label>
              <textarea
                id="page-about"
                rows={3}
                value={form.about}
                onChange={(event) => update({ about: event.target.value })}
                placeholder="A short paragraph near the bottom of the page."
              />
            </div>
          </section>

          <section className="card form-section">
            <div className="section-heading">
              <h2>Page header</h2>
              <p className="muted small">The big photo, headline and intro at the top of the page.</p>
            </div>

            <div className={`form-field ${fieldClass("headline")}`}>
              <label htmlFor="page-headline" className="field-title">
                Headline <span className="required">*</span>
              </label>
              <input
                id="page-headline"
                value={form.feature.headline}
                onChange={(event) => updateFeature({ headline: event.target.value })}
                placeholder="e.g. Gifts for the dad who says he wants nothing"
                maxLength={120}
              />
              {errors.headline && <p className="field-error">{errors.headline}</p>}
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="page-highlight" className="field-title">
                  Word to underline
                </label>
                <input
                  id="page-highlight"
                  value={form.feature.highlight}
                  onChange={(event) => updateFeature({ highlight: event.target.value })}
                  placeholder="e.g. nothing"
                />
                {highlightMissing ? (
                  <p className="field-hint warning-hint">That isn't in the headline, so nothing gets underlined.</p>
                ) : (
                  <p className="field-hint">A word or two from the headline, drawn with a gold underline.</p>
                )}
              </div>
              <div className="form-field">
                <label htmlFor="page-updated" className="field-title">
                  “Updated” date
                </label>
                <div className="input-with-button">
                  <input id="page-updated" value={form.feature.updated} onChange={(event) => updateFeature({ updated: event.target.value })} placeholder="November 2026" />
                  <button type="button" className="button button-light" onClick={() => updateFeature({ updated: thisMonth() })}>
                    This month
                  </button>
                </div>
              </div>
            </div>

            <div className={fieldClass("image")}>
              <MediaInput
                id="page-image"
                label={
                  <>
                    Header photo <span className="required">*</span>
                  </>
                }
                value={form.feature.image.src}
                onChange={(src) => updateFeature({ image: { ...form.feature.image, src } })}
                error={errors.image}
              />
            </div>
            <div className="form-field">
              <label htmlFor="page-image-alt" className="field-title">
                Describe the photo <span className="optional">for screen readers</span>
              </label>
              <input
                id="page-image-alt"
                value={form.feature.image.alt}
                onChange={(event) => updateFeature({ image: { ...form.feature.image, alt: event.target.value } })}
                placeholder="e.g. Friends relaxing outside a camper at dusk"
              />
            </div>

            <div className="form-field">
              <label htmlFor="page-intro" className="field-title">
                Intro
              </label>
              <textarea
                id="page-intro"
                rows={5}
                value={form.introText}
                onChange={(event) => update({ introText: event.target.value })}
                placeholder="A friendly paragraph under the headline."
              />
              <p className="field-hint">
                Add a link by writing <code>[gifts for mom](/gifts/for-mom)</code>.
              </p>
              {introParts.some((part) => typeof part !== "string") && (
                <p className="intro-preview">
                  {introParts.map((part, index) =>
                    typeof part === "string" ? (
                      <span key={index}>{part}</span>
                    ) : (
                      <a key={index} href={`${SITE_URL}${part.href}`} target="_blank" rel="noreferrer">
                        {part.label}
                      </a>
                    ),
                  )}
                </p>
              )}
            </div>
          </section>

          <section className="card form-section">
            <div className="section-heading">
              <h2>Which products show</h2>
              <p className="muted small">Every setting you use must match. Leave everything empty to show all products.</p>
            </div>

            <label className="toggle-row hand-pick-toggle">
              <span>
                <strong>Only show products I pick</strong>
                <span className="muted small">Choose exact products instead of a rule, like an editor's picks page.</span>
              </span>
              <Switch
                checked={handPicked}
                onChange={(on) => updateRule({ ids: on ? (match?.sample || []).slice(0, 4).map((product) => product.slug) : [] })}
                label="Only show products I pick"
              />
            </label>

            {handPicked && (
              <div className="form-field">
                <ol className="email-products">
                  {pickedProducts.map((product, index) => (
                    <li key={product.slug} className="email-product">
                      <span className="email-product-number">{index + 1}</span>
                      {product.image ? <img src={thumbUrl(product.image.src)} alt="" className="product-thumb small" /> : <span className="link-icon" />}
                      <div className="email-product-text">
                        <strong>{product.name}</strong>
                        <span className="muted small">{product.missing ? "Hidden or deleted, won't show" : `$${Number(product.price.amount).toFixed(2)}`}</span>
                      </div>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="action-button"
                          disabled={index === 0}
                          onClick={() => {
                            const ids = [...form.rule.ids];
                            [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                            updateRule({ ids });
                          }}
                          aria-label={`Move ${product.name} up`}
                        >
                          <ArrowUp size={15} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="action-button"
                          disabled={index === pickedProducts.length - 1}
                          onClick={() => {
                            const ids = [...form.rule.ids];
                            [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
                            updateRule({ ids });
                          }}
                          aria-label={`Move ${product.name} down`}
                        >
                          <ArrowDown size={15} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="action-button is-danger"
                          onClick={() => updateRule({ ids: form.rule.ids.filter((slug) => slug !== product.slug) })}
                          aria-label={`Remove ${product.name}`}
                        >
                          <X size={15} aria-hidden />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="product-picker">
                  <label className="search-field">
                    <Search size={16} aria-hidden />
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
                      placeholder="Add a product by name…"
                    />
                  </label>
                  {pickerOpen && pickerMatches.length > 0 && (
                    <ul className="picker-results" role="listbox">
                      {pickerMatches.map((product) => (
                        <li key={product._id}>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              updateRule({ ids: [...form.rule.ids, product.slug] });
                              setPickerText("");
                              setPickerOpen(false);
                            }}
                          >
                            <img src={thumbUrl(product.image.src)} alt="" />
                            <span>{product.name}</span>
                            <span className="muted small">${Number(product.price.amount).toFixed(2)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="field-hint">The settings below still apply, so a picked product that doesn't fit them won't show.</p>
              </div>
            )}

            <div className="form-field">
              <span className="field-title" id="rule-audience-label">
                Who it's for <span className="optional">any of these</span>
              </span>
              <div className="choice-chips" role="group" aria-labelledby="rule-audience-label">
                {audienceOptions.map((audience) => {
                  const selected = form.rule.audiences.includes(audience.id);
                  return (
                    <button
                      key={audience.id}
                      type="button"
                      aria-pressed={selected}
                      className={`choice-chip ${selected ? "is-selected" : ""}`}
                      onClick={() => updateRule({ audiences: toggle(form.rule.audiences, audience.id) })}
                    >
                      {selected && <Check size={14} aria-hidden />}
                      {audience.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-field">
              <span className="field-title" id="rule-interest-label">
                Interests <span className="optional">any of these</span>
              </span>
              <div className="choice-chips" role="group" aria-labelledby="rule-interest-label">
                {categories.map((category) => {
                  const selected = form.rule.interests.includes(category.slug);
                  return (
                    <button
                      key={category._id}
                      type="button"
                      aria-pressed={selected}
                      className={`choice-chip with-image ${selected ? "is-selected" : ""}`}
                      onClick={() => updateRule({ interests: toggle(form.rule.interests, category.slug) })}
                    >
                      {category.image?.src && <img src={sizedImageUrl(category.image.src, 60)} alt="" />}
                      {category.label}
                      {selected && <Check size={14} aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="rule-price" className="field-title">
                  Price limit
                </label>
                <div className="input-with-icon">
                  <span aria-hidden>$</span>
                  <input
                    id="rule-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.rule.maxPrice}
                    onChange={(event) => updateRule({ maxPrice: event.target.value })}
                    placeholder="No limit"
                  />
                </div>
                <div className="suggestion-chips">
                  {priceIdeas.map((price) => (
                    <button
                      key={price}
                      type="button"
                      className={`choice-chip small ${Number(form.rule.maxPrice) === price - 0.01 ? "is-selected" : ""}`}
                      onClick={() => updateRule({ maxPrice: Number(form.rule.maxPrice) === price - 0.01 ? "" : price - 0.01 })}
                    >
                      Under ${price}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-field">
                <span className="field-title" id="rule-sort-label">
                  Order
                </span>
                <div className="segmented" role="radiogroup" aria-labelledby="rule-sort-label">
                  {sortOptions.map((option) => (
                    <button
                      key={option.id || "default"}
                      type="button"
                      role="radio"
                      aria-checked={form.rule.sort === option.id}
                      className={form.rule.sort === option.id ? "is-selected" : ""}
                      onClick={() => updateRule({ sort: option.id })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label className="toggle-row">
              <span>
                <strong>
                  <Flame size={15} aria-hidden /> Trending products only
                </strong>
                <span className="muted small">Only products marked as trending on the Products page.</span>
              </span>
              <Switch checked={form.rule.trending} onChange={(trending) => updateRule({ trending })} label="Trending products only" />
            </label>
          </section>

          <section className="card form-section">
            <div className="section-heading">
              <h2>Around the page</h2>
              <p className="muted small">Interest tiles, links to other pages and the gift guide shown in the product grid.</p>
            </div>

            <div className="form-field">
              <span className="field-title" id="tiles-label">
                “Shop by interest” tiles
              </span>
              <div className="choice-chips" role="group" aria-labelledby="tiles-label">
                {categories.map((category) => {
                  const position = form.interests.indexOf(category.slug);
                  return (
                    <button
                      key={category._id}
                      type="button"
                      aria-pressed={position !== -1}
                      className={`choice-chip ${position !== -1 ? "is-selected" : ""}`}
                      onClick={() => update({ interests: toggle(form.interests, category.slug) })}
                    >
                      {position !== -1 && <span className="chip-number">{position + 1}</span>}
                      {category.label}
                    </button>
                  );
                })}
              </div>
              <p className="field-hint">Shown in the order you pick them. Tiles with no products on this page are hidden automatically.</p>
            </div>

            <div className="form-field">
              <span className="field-title" id="related-label">
                Related pages
              </span>
              {sectionPages.length === 0 ? (
                <p className="muted small">No other pages in this part of the site yet.</p>
              ) : (
                <div className="choice-chips" role="group" aria-labelledby="related-label">
                  {sectionPages.map((page) => {
                    const selected = form.related.includes(page.slug);
                    return (
                      <button
                        key={page._id}
                        type="button"
                        aria-pressed={selected}
                        className={`choice-chip ${selected ? "is-selected" : ""}`}
                        onClick={() => update({ related: toggle(form.related, page.slug) })}
                      >
                        {selected && <Check size={14} aria-hidden />}
                        {page.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="page-guide" className="field-title">
                Gift guide in the product grid
              </label>
              <select id="page-guide" value={form.guideId} onChange={(event) => update({ guideId: event.target.value })}>
                <option value="">The first guide</option>
                {articles.map((article) => (
                  <option key={article.id} value={article.id}>
                    {article.title}
                  </option>
                ))}
              </select>
            </div>

            <details className="more-titles">
              <summary>More titles (optional)</summary>
              <div className="form-field">
                <label htmlFor="page-meta" className="field-title">
                  Title in Google and browser tabs
                </label>
                <input id="page-meta" value={form.metaTitle} onChange={(event) => update({ metaTitle: event.target.value })} placeholder={form.title ? `Unique ${form.title}` : ""} />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="page-grid-title" className="field-title">
                    Product grid title
                  </label>
                  <input id="page-grid-title" value={form.gridTitle} onChange={(event) => update({ gridTitle: event.target.value })} placeholder={`all ${form.title || "gifts"}`} />
                </div>
                <div className="form-field">
                  <label htmlFor="page-picks-title" className="field-title">
                    Top picks title
                  </label>
                  <input id="page-picks-title" value={form.picksTitle} onChange={(event) => update({ picksTitle: event.target.value })} placeholder={`most-loved ${form.title || "gifts"}`} />
                </div>
              </div>
            </details>
          </section>
        </div>

        <aside className="form-side">
          <section className="card side-card">
            <div className="side-card-heading">
              <h2>Header preview</h2>
            </div>
            <div className="page-preview">
              <div className="page-preview-image">
                {form.feature.image.src ? <img src={sizedImageUrl(form.feature.image.src, 640)} alt="" /> : <span className="preview-placeholder">Header photo goes here</span>}
              </div>
              <p className="page-preview-updated">{form.feature.updated ? `Updated ${form.feature.updated}` : "Gift guide"}</p>
              <h3 className="page-preview-headline">
                <Headline text={form.feature.headline || "Your headline"} highlight={form.feature.highlight} />
              </h3>
              {form.tagline && <p className="page-preview-tagline">{form.tagline}</p>}
            </div>
          </section>

          <section className="card side-card">
            <div className="side-card-heading">
              <h2>Products on this page</h2>
              {match && <span className={`product-count ${match.count === 0 ? "is-empty" : ""}`}>{match.count}</span>}
            </div>
            {!match ? (
              <p className="muted small">Counting…</p>
            ) : match.count === 0 ? (
              <p className="match-empty">
                <TriangleAlert size={16} aria-hidden /> No products match. Visitors would see an empty page. Loosen the rule.
              </p>
            ) : (
              <>
                <div className="match-thumbs">
                  {match.sample.map((product) => (
                    <img key={product._id} src={thumbUrl(product.image.src)} alt={product.name} title={product.name} />
                  ))}
                  {match.count > match.sample.length && <span className="match-more">+{match.count - match.sample.length}</span>}
                </div>
                <p className="muted small">
                  <Package size={13} aria-hidden /> {match.count} {match.count === 1 ? "product fits" : "products fit"} the rule, in the order shown.
                </p>
              </>
            )}
          </section>

          <section className="card side-card">
            <h2>Page address</h2>
            <div className="referral-copy">
              <code>{address}</code>
              <button type="button" className="action-button" onClick={copyAddress} aria-label="Copy page address" title="Copy">
                <Copy size={16} aria-hidden />
              </button>
              {!isNew && (
                <a href={`${SITE_URL}${address}`} target="_blank" rel="noreferrer" className="action-button" aria-label="Open the page on the website" title="Open">
                  <ExternalLink size={16} aria-hidden />
                </a>
              )}
            </div>
            {isNew && <p className="field-hint">The page goes live as soon as you create it.</p>}
          </section>

          {!isNew && (
            <section className="card side-card danger-card">
              <h2>Delete page</h2>
              <p className="muted small">Links and menus pointing here will stop working.</p>
              <button type="button" className="button button-danger" onClick={askDelete}>
                <Trash2 size={15} aria-hidden /> Delete page
              </button>
            </section>
          )}
        </aside>
      </div>

      <Drawer
        open={jsonOpen}
        onClose={() => setJsonOpen(false)}
        title="Edit as JSON"
        subtitle="For advanced changes. Apply, then save the page."
        footer={
          <>
            <button type="button" className="button button-light" onClick={() => setJsonOpen(false)}>
              Cancel
            </button>
            <button type="button" className="button" onClick={applyJson}>
              Apply
            </button>
          </>
        }
      >
        {jsonError && <p className="notice notice-error">{jsonError}</p>}
        <textarea className="json-editor drawer-json" value={jsonText} onChange={(event) => setJsonText(event.target.value)} spellCheck={false} aria-label="Page JSON" />
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
    </form>
  );
}
