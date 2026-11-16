import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  DollarSign,
  ExternalLink,
  Eye,
  Flame,
  Heart,
  Link2,
  LoaderCircle,
  MousePointerClick,
  Tag,
  Trash2,
} from "lucide-react";
import { api, sizedImageUrl } from "../api.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import MediaInput from "../components/MediaInput.jsx";
import Switch from "../components/Switch.jsx";
import { Toasts, useToastFromNavigation, useToasts } from "../components/Toasts.jsx";

const audienceOptions = [
  { id: "everyone", label: "Everyone" },
  { id: "men", label: "Men" },
  { id: "women", label: "Women" },
  { id: "kids", label: "Kids" },
  { id: "couples", label: "Couples" },
];

const shopOptions = [
  { id: "amazon", label: "Amazon", color: "var(--series-1)" },
  { id: "temu", label: "Temu", color: "var(--series-2)" },
];

const badgeIdeas = ["Editor's pick", "Bestseller", "New", "Trending", "Under $25", "Limited"];
const DESCRIPTION_LIMIT = 140;

const emptyProduct = {
  name: "",
  slug: "",
  description: "",
  details: "",
  price: { amount: "" },
  retailer: "amazon",
  affiliateUrl: "",
  badge: "",
  audiences: ["everyone"],
  categories: [],
  image: { src: "", alt: "" },
  altImage: { src: "", alt: "" },
  video: { src: "" },
  trending: false,
  active: true,
  isSampleData: false,
};

// Only the fields the form edits, so we can tell when something has changed.
function formFields(product) {
  return {
    ...emptyProduct,
    ...product,
    price: { amount: product.price?.amount ?? "" },
    image: { src: product.image?.src || "", alt: product.image?.alt || "" },
    altImage: { src: product.altImage?.src || "", alt: product.altImage?.alt || "" },
    video: { src: product.video?.src || "" },
  };
}

function snapshot(product) {
  const { name, slug, description, details, price, retailer, affiliateUrl, badge, audiences, categories, image, altImage, video, trending, active, isSampleData } =
    product;
  return JSON.stringify({ name, slug, description, details, price: String(price.amount), retailer, affiliateUrl, badge, audiences, categories, image, altImage, video, trending, active, isSampleData });
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function checkForm(product) {
  const errors = {};
  if (!product.name.trim()) errors.name = "Give the product a name.";
  if (!product.description.trim()) errors.description = "Write a short description for the product card.";
  const price = Number(product.price.amount);
  if (product.price.amount === "" || !Number.isFinite(price) || price < 0) errors.price = "Enter a price, like 24.99.";
  if (!/^https?:\/\/\S+$/.test(product.affiliateUrl.trim())) errors.affiliateUrl = "Paste the full shop link, starting with https://";
  if (!product.image.src) errors.image = "Add a main photo. It's the first thing shoppers see.";
  return errors;
}

const fieldOrder = ["name", "description", "price", "affiliateUrl", "image"];

export default function ProductFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [product, setProduct] = useState(formFields(emptyProduct));
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot(formFields(emptyProduct)));
  const [slugEdited, setSlugEdited] = useState(!isNew);
  const [categories, setCategories] = useState([]);
  const [referral, setReferral] = useState({ url: "", clicks: 0 });
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [triedToSave, setTriedToSave] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { toasts, showToast, removeToast } = useToasts();
  const formRef = useRef(null);

  const isDirty = snapshot(product) !== savedSnapshot;

  useEffect(() => {
    api("/categories")
      .then((data) => setCategories(data.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) {
      const fresh = formFields(emptyProduct);
      setProduct(fresh);
      setSavedSnapshot(snapshot(fresh));
      setSlugEdited(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    api(`/products/${id}`)
      .then((data) => {
        const loaded = formFields(data.product);
        setProduct(loaded);
        setSavedSnapshot(snapshot(loaded));
        setSlugEdited(true);
        setReferral({ url: data.product.referralUrl, clicks: data.product.clicks });
      })
      .catch((problem) => setLoadError(problem.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  useToastFromNavigation(showToast);

  useEffect(() => {
    if (!isDirty) return;
    function warn(event) {
      event.preventDefault();
    }
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

  function update(changes) {
    setProduct((current) => {
      const next = { ...current, ...changes };
      if (triedToSave) setErrors(checkForm(next));
      return next;
    });
  }

  function updateName(name) {
    update(slugEdited ? { name } : { name, slug: slugify(name) });
  }

  function toggleInList(field, value) {
    const list = product[field].includes(value) ? product[field].filter((item) => item !== value) : [...product[field], value];
    update({ [field]: list });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setTriedToSave(true);
    const found = checkForm(product);
    setErrors(found);
    const firstProblem = fieldOrder.find((field) => found[field]);
    if (firstProblem) {
      const element = document.getElementById(`product-${firstProblem}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.focus({ preventScroll: true });
      showToast("Please fix the highlighted fields.", "error");
      return;
    }

    setSaving(true);
    try {
      const body = { ...product, slug: product.slug || slugify(product.name) };
      if (isNew) {
        const data = await api("/products", { method: "POST", body });
        setSavedSnapshot(snapshot(product));
        navigate(`/products/${data.product._id}`, { state: { toast: `"${data.product.name}" was added.` } });
      } else {
        const data = await api(`/products/${id}`, { method: "PUT", body });
        const saved = formFields(data.product);
        setProduct(saved);
        setSavedSnapshot(snapshot(saved));
        showToast("Changes saved.");
      }
    } catch (problem) {
      showToast(problem.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function leavePage() {
    if (!isDirty) return navigate("/products");
    setDialog({
      title: "Leave without saving?",
      message: "You have changes that haven't been saved. They'll be lost if you leave now.",
      confirmLabel: "Leave page",
      onConfirm: () => {
        setSavedSnapshot(snapshot(product));
        navigate("/products");
      },
    });
  }

  function askDelete() {
    setDialog({
      title: `Delete "${product.name}"?`,
      message: "It will be removed from the website, along with its referral link and click history. This can't be undone.",
      confirmLabel: "Delete product",
      onConfirm: async () => {
        setDeleting(true);
        try {
          await api(`/products/${id}`, { method: "DELETE" });
          navigate("/products", { state: { toast: `"${product.name}" was deleted.` } });
        } catch (problem) {
          showToast(problem.message, "error");
          setDeleting(false);
          setDialog(null);
        }
      },
    });
  }

  async function copyReferral() {
    try {
      await navigator.clipboard.writeText(referral.url);
      showToast("Referral link copied.");
    } catch {
      showToast("Could not copy. Please copy the link by hand.", "error");
    }
  }

  if (loading) {
    return (
      <div className="form-loading">
        <LoaderCircle size={22} className="spin" aria-hidden /> Loading product…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card empty-state">
        <h2>Couldn't open this product</h2>
        <p className="muted">{loadError}</p>
        <Link to="/products" className="button button-light">
          Back to products
        </Link>
      </div>
    );
  }

  const descriptionLength = product.description.length;
  const fieldClass = (name) => (errors[name] ? "has-error" : "");

  return (
    <form ref={formRef} className="product-form-page" onSubmit={handleSubmit} noValidate>
      <header className="form-topbar">
        <div className="form-topbar-title">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <button type="button" className="text-button" onClick={leavePage}>
              Products
            </button>
            <ChevronRight size={14} aria-hidden />
            <span aria-current="page">{isNew ? "New product" : "Edit"}</span>
          </nav>
          <h1>
            {isNew ? "Add a product" : product.name || "Untitled product"}
            {!isNew && <span className={`status-pill ${product.active ? "is-live" : ""}`}>{product.active ? "Live" : "Hidden"}</span>}
          </h1>
        </div>
        <div className="form-topbar-actions">
          {isDirty && (
            <span className="unsaved-note">
              <span className="unsaved-dot" aria-hidden /> Unsaved changes
            </span>
          )}
          <button type="button" className="button button-light" onClick={leavePage}>
            Cancel
          </button>
          <button type="submit" className="button" disabled={saving || (!isNew && !isDirty)} title="Save (Ctrl + S)">
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden /> : <Check size={16} aria-hidden />}
            {saving ? "Saving…" : isNew ? "Add product" : "Save changes"}
          </button>
        </div>
      </header>

      <div className="product-form-layout">
        <div className="form-main">
          <section className="card form-section">
            <div className="section-heading">
              <h2>Product details</h2>
              <p className="muted small">What shoppers read on the product card.</p>
            </div>

            <div className={`form-field ${fieldClass("name")}`}>
              <label htmlFor="product-name" className="field-title">
                Name <span className="required">*</span>
              </label>
              <input
                id="product-name"
                value={product.name}
                onChange={(event) => updateName(event.target.value)}
                placeholder="e.g. Glass Pour-Over Coffee Set"
                aria-invalid={Boolean(errors.name)}
                maxLength={120}
              />
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>

            <div className="form-field">
              <label htmlFor="product-slug" className="field-title">
                Link name
              </label>
              <div className="input-with-prefix">
                <span className="input-prefix">/go/</span>
                <input
                  id="product-slug"
                  value={product.slug}
                  onChange={(event) => {
                    setSlugEdited(true);
                    update({ slug: event.target.value });
                  }}
                  onBlur={() => update({ slug: slugify(product.slug) })}
                  placeholder="made-from-the-name"
                />
              </div>
              <p className="field-hint">
                {isNew ? "Filled in from the name. Used for the product's ID and its referral link." : "Changing this won't break the existing referral link."}
              </p>
            </div>

            <div className={`form-field ${fieldClass("description")}`}>
              <div className="field-title-row">
                <label htmlFor="product-description" className="field-title">
                  Short description <span className="required">*</span>
                </label>
                <span className={`char-count ${descriptionLength > DESCRIPTION_LIMIT ? "is-over" : ""}`}>
                  {descriptionLength}/{DESCRIPTION_LIMIT}
                </span>
              </div>
              <textarea
                id="product-description"
                rows={2}
                value={product.description}
                onChange={(event) => update({ description: event.target.value })}
                placeholder="One or two sentences on why it makes a great gift."
                aria-invalid={Boolean(errors.description)}
              />
              {errors.description ? (
                <p className="field-error">{errors.description}</p>
              ) : (
                descriptionLength > DESCRIPTION_LIMIT && <p className="field-hint">Cards show about two lines, so shorter reads better.</p>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="product-details" className="field-title">
                Longer write-up <span className="optional">optional</span>
              </label>
              <textarea
                id="product-details"
                rows={4}
                value={product.details}
                onChange={(event) => update({ details: event.target.value })}
                placeholder="Shown on gift pages and in the gift finder. Who it's for, what makes it special…"
              />
            </div>
          </section>

          <section className="card form-section">
            <div className="section-heading">
              <h2>Price and shop</h2>
              <p className="muted small">Where shoppers go when they click "Check it out".</p>
            </div>

            <div className="form-row">
              <div className={`form-field ${fieldClass("price")}`}>
                <label htmlFor="product-price" className="field-title">
                  Price (USD) <span className="required">*</span>
                </label>
                <div className="input-with-icon">
                  <DollarSign size={15} aria-hidden />
                  <input
                    id="product-price"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={product.price.amount}
                    onChange={(event) => update({ price: { amount: event.target.value } })}
                    placeholder="0.00"
                    aria-invalid={Boolean(errors.price)}
                  />
                </div>
                {errors.price && <p className="field-error">{errors.price}</p>}
              </div>

              <div className="form-field">
                <span className="field-title" id="shop-label">
                  Shop
                </span>
                <div className="segmented" role="radiogroup" aria-labelledby="shop-label">
                  {shopOptions.map((shop) => (
                    <button
                      key={shop.id}
                      type="button"
                      role="radio"
                      aria-checked={product.retailer === shop.id}
                      className={product.retailer === shop.id ? "is-selected" : ""}
                      onClick={() => update({ retailer: shop.id })}
                    >
                      <span className="shop-dot" style={{ background: shop.color }} aria-hidden />
                      {shop.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={`form-field ${fieldClass("affiliateUrl")}`}>
              <label htmlFor="product-affiliateUrl" className="field-title">
                Affiliate link <span className="required">*</span>
              </label>
              <div className="input-with-button">
                <div className="input-with-icon">
                  <Link2 size={15} aria-hidden />
                  <input
                    id="product-affiliateUrl"
                    type="url"
                    value={product.affiliateUrl}
                    onChange={(event) => update({ affiliateUrl: event.target.value.trim() })}
                    placeholder={product.retailer === "temu" ? "https://www.temu.com/…" : "https://www.amazon.com/dp/…"}
                    aria-invalid={Boolean(errors.affiliateUrl)}
                  />
                </div>
                <a
                  href={/^https?:\/\//.test(product.affiliateUrl) ? product.affiliateUrl : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`button button-light ${/^https?:\/\//.test(product.affiliateUrl) ? "" : "is-disabled"}`}
                  aria-disabled={!/^https?:\/\//.test(product.affiliateUrl)}
                >
                  <ExternalLink size={15} aria-hidden /> Test link
                </a>
              </div>
              {errors.affiliateUrl ? (
                <p className="field-error">{errors.affiliateUrl}</p>
              ) : (
                <p className="field-hint">Visitors go through your referral link first, so every click is counted.</p>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="product-badge" className="field-title">
                Badge <span className="optional">optional</span>
              </label>
              <div className="input-with-icon">
                <Tag size={15} aria-hidden />
                <input
                  id="product-badge"
                  value={product.badge}
                  onChange={(event) => update({ badge: event.target.value })}
                  placeholder="A short label on the photo"
                  maxLength={30}
                />
              </div>
              <div className="suggestion-chips">
                {badgeIdeas.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    className={`choice-chip small ${product.badge === idea ? "is-selected" : ""}`}
                    onClick={() => update({ badge: product.badge === idea ? "" : idea })}
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card form-section">
            <div className="section-heading">
              <h2>Photos and video</h2>
              <p className="muted small">The second photo or the video plays when someone hovers over the card.</p>
            </div>

            <div className={fieldClass("image")}>
              <MediaInput
                id="product-image"
                label={
                  <>
                    Main photo <span className="required">*</span>
                  </>
                }
                value={product.image.src}
                onChange={(src) => update({ image: { ...product.image, src } })}
                error={errors.image}
              />
            </div>
            <div className="form-field">
              <label htmlFor="product-image-alt" className="field-title">
                Describe the main photo <span className="optional">for screen readers</span>
              </label>
              <input
                id="product-image-alt"
                value={product.image.alt}
                onChange={(event) => update({ image: { ...product.image, alt: event.target.value } })}
                placeholder="e.g. Glass coffee dripper and kettle on a dark counter"
              />
            </div>

            <div className="media-pair">
              <MediaInput
                id="product-alt-image"
                label="Hover photo"
                hint="Optional. Shown when someone hovers."
                value={product.altImage.src}
                onChange={(src) => update({ altImage: { ...product.altImage, src } })}
              />
              <MediaInput
                id="product-video"
                label="Hover video"
                kind="video"
                hint="Optional. Plays muted on hover."
                value={product.video.src}
                onChange={(src) => update({ video: { src } })}
              />
            </div>
          </section>

          <section className="card form-section">
            <div className="section-heading">
              <h2>Who it's for</h2>
              <p className="muted small">Decides which gift pages and gift finder answers show this product.</p>
            </div>

            <div className="form-field">
              <span className="field-title" id="audience-label">
                Good for
              </span>
              <div className="choice-chips" role="group" aria-labelledby="audience-label">
                {audienceOptions.map((audience) => {
                  const selected = product.audiences.includes(audience.id);
                  return (
                    <button
                      key={audience.id}
                      type="button"
                      aria-pressed={selected}
                      className={`choice-chip ${selected ? "is-selected" : ""}`}
                      onClick={() => toggleInList("audiences", audience.id)}
                    >
                      {selected && <Check size={14} aria-hidden />}
                      {audience.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-field">
              <div className="field-title-row">
                <span className="field-title" id="category-label">
                  Categories
                </span>
                <Link to="/categories" className="small">
                  Manage categories
                </Link>
              </div>
              {categories.length === 0 ? (
                <p className="muted small">No categories yet. Add some on the Categories page.</p>
              ) : (
                <div className="choice-chips" role="group" aria-labelledby="category-label">
                  {categories.map((category) => {
                    const selected = product.categories.includes(category.slug);
                    return (
                      <button
                        key={category._id}
                        type="button"
                        aria-pressed={selected}
                        className={`choice-chip with-image ${selected ? "is-selected" : ""}`}
                        onClick={() => toggleInList("categories", category.slug)}
                      >
                        {category.image?.src && <img src={sizedImageUrl(category.image.src, 60)} alt="" />}
                        {category.label}
                        {selected && <Check size={14} aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              )}
              {product.categories.length === 0 && categories.length > 0 && (
                <p className="field-hint warning-hint">Without a category, shoppers can't find this product through filters.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="form-side">
          <section className="card side-card">
            <h2>Visibility</h2>
            <label className="toggle-row">
              <span>
                <strong>
                  <Eye size={15} aria-hidden /> Show on the website
                </strong>
                <span className="muted small">Hidden products stay here but not on the site.</span>
              </span>
              <Switch checked={product.active} onChange={(active) => update({ active })} label="Show on the website" />
            </label>
            <label className="toggle-row">
              <span>
                <strong>
                  <Flame size={15} aria-hidden /> Trending
                </strong>
                <span className="muted small">Shows on the homepage and the trending page.</span>
              </span>
              <Switch checked={product.trending} onChange={(trending) => update({ trending })} label="Trending" />
            </label>
            <label className="toggle-row">
              <span>
                <strong>
                  <Tag size={15} aria-hidden /> Sample price
                </strong>
                <span className="muted small">Adds a "Sample price" note next to the price.</span>
              </span>
              <Switch checked={product.isSampleData} onChange={(isSampleData) => update({ isSampleData })} label="Sample price" />
            </label>
          </section>

          <section className="card side-card">
            <div className="side-card-heading">
              <h2>Preview</h2>
              <span className="muted small">How it looks on the site</span>
            </div>
            <ProductPreview product={product} />
          </section>

          {!isNew && referral.url && (
            <section className="card side-card">
              <h2>Referral link</h2>
              <div className="referral-copy">
                <code title={referral.url}>{referral.url.replace(/^https?:\/\//, "")}</code>
                <button type="button" className="action-button" onClick={copyReferral} aria-label="Copy referral link" title="Copy">
                  <Copy size={16} aria-hidden />
                </button>
              </div>
              <p className="referral-stat">
                <MousePointerClick size={16} aria-hidden />
                <strong>{referral.clicks}</strong> {referral.clicks === 1 ? "click" : "clicks"} so far
              </p>
            </section>
          )}

          {!isNew && (
            <section className="card side-card danger-card">
              <h2>Delete product</h2>
              <p className="muted small">Removes it from the website along with its referral link and click history.</p>
              <button type="button" className="button button-danger" onClick={askDelete}>
                <Trash2 size={15} aria-hidden /> Delete product
              </button>
            </section>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        onConfirm={() => dialog?.onConfirm()}
        onCancel={() => !deleting && setDialog(null)}
        busy={deleting}
      />
      <Toasts toasts={toasts} onClose={removeToast} />
    </form>
  );
}

function ProductPreview({ product }) {
  const [hovering, setHovering] = useState(false);
  const shop = shopOptions.find((item) => item.id === product.retailer);
  const price = Number(product.price.amount);
  const hoverImage = product.altImage.src;

  return (
    <article className="preview-card" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <div className="preview-image">
        {product.image.src ? (
          <img src={sizedImageUrl(hovering && hoverImage ? hoverImage : product.image.src, 500)} alt="" />
        ) : (
          <span className="preview-placeholder">Main photo goes here</span>
        )}
        {product.badge && <span className="preview-badge">{product.badge}</span>}
      </div>
      <p className="preview-shop">Available at {shop?.label}</p>
      <h3 className="preview-name">{product.name || "Product name"}</h3>
      <p className="preview-description">{product.description || "Short description shows here."}</p>
      <p className="preview-price">
        {product.price.amount !== "" && Number.isFinite(price) ? `$${price.toFixed(2)}` : "$0.00"}
        {product.isSampleData && <span>Sample price</span>}
      </p>
      <div className="preview-buttons">
        <span className="preview-button">
          Check it out <ArrowUpRight size={14} aria-hidden />
        </span>
        <span className="preview-button is-light">
          <Heart size={14} aria-hidden /> Save
        </span>
      </div>
    </article>
  );
}
