import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, FileText, LoaderCircle, Package, Pencil, Plus, Search, TriangleAlert, X } from "lucide-react";
import { SITE_URL, api, sizedImageUrl } from "../api.js";
import { Toasts, useToastFromNavigation, useToasts } from "../components/Toasts.jsx";
import { pagePath, ruleSummary, sectionLabel, sectionOptions } from "../components/giftPages.js";

export default function PagesPage() {
  const [pages, setPages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [section, setSection] = useState("all");
  const [search, setSearch] = useState("");
  const { toasts, showToast, removeToast } = useToasts();
  useToastFromNavigation(showToast);

  useEffect(() => {
    api("/pages")
      .then((data) => setPages(data.pages))
      .catch((problem) => setLoadError(problem.message))
      .finally(() => setLoading(false));
    api("/categories")
      .then((data) => setCategories(data.categories))
      .catch(() => {});
  }, []);

  const categoryNames = useMemo(() => Object.fromEntries(categories.map((item) => [item.slug, item.label])), [categories]);
  const searchText = search.trim().toLowerCase();
  const searched = pages.filter(
    (page) => !searchText || `${page.label} ${page.title} ${page.tagline} ${pagePath(page)}`.toLowerCase().includes(searchText),
  );
  const tabs = [{ id: "all", label: "All pages" }, ...sectionOptions];
  const counts = Object.fromEntries(tabs.map((tab) => [tab.id, searched.filter((page) => tab.id === "all" || page.section === tab.id).length]));
  const shown = searched.filter((page) => section === "all" || page.section === section);
  const emptyPages = pages.filter((page) => page.productCount === 0).length;

  return (
    <div className="gift-pages-page">
      <div className="page-header">
        <div>
          <h1>Gift pages</h1>
          <p className="muted page-subtitle">
            {pages.length} pages like /gifts/for-dad. Each one shows the products that fit its rule.
          </p>
        </div>
        <Link to="/pages/new" className="button">
          <Plus size={16} aria-hidden /> New page
        </Link>
      </div>

      {loadError && <p className="notice notice-error">{loadError}</p>}
      {emptyPages > 0 && (
        <div className="setup-banner is-warning">
          <TriangleAlert size={18} aria-hidden />
          <div>
            <strong>
              {emptyPages} {emptyPages === 1 ? "page shows" : "pages show"} no products.
            </strong>{" "}
            Visitors would land on an empty page. Loosen the rule or add matching products.
          </div>
        </div>
      )}

      <div className="status-tabs" role="tablist" aria-label="Site section">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={section === tab.id}
            className={`status-tab ${section === tab.id ? "is-selected" : ""}`}
            onClick={() => setSection(tab.id)}
          >
            {tab.label}
            <span className="status-count">{counts[tab.id]}</span>
          </button>
        ))}
      </div>

      <div className="products-toolbar">
        <label className="search-field">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search gift pages</span>
          <input type="search" placeholder="Search by name, tagline or address…" value={search} onChange={(event) => setSearch(event.target.value)} />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
              <X size={14} aria-hidden />
            </button>
          )}
        </label>
      </div>

      {loading ? (
        <div className="form-loading">
          <LoaderCircle size={20} className="spin" aria-hidden /> Loading pages…
        </div>
      ) : shown.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon" aria-hidden>
            <FileText size={26} />
          </span>
          <h2>{search ? "No pages match" : "No pages here yet"}</h2>
          <p className="muted">{search ? "Try another search." : "Create a page to group gifts for a person, occasion or budget."}</p>
          <Link to="/pages/new" className="button">
            <Plus size={16} aria-hidden /> New page
          </Link>
        </div>
      ) : (
        <ul className="page-grid">
          {shown.map((page) => (
            <li key={page._id} className="page-card">
              <Link to={`/pages/${page._id}`} className="page-card-link">
                <span className="page-card-image">
                  {page.feature?.image?.src && <img src={sizedImageUrl(page.feature.image.src, 520)} alt="" loading="lazy" />}
                  <span className="page-card-section">{sectionLabel(page.section)}</span>
                  {!page.slug && <span className="page-card-home">Section home</span>}
                </span>
                <span className="page-card-body">
                  <strong className="page-card-title">{page.label}</strong>
                  <code className="page-card-path">{pagePath(page)}</code>
                  <span className="page-card-tagline">{page.tagline || page.feature?.headline}</span>
                  <span className="rule-chips">
                    {ruleSummary(page.rule, categoryNames).map((part) => (
                      <span key={part} className="rule-chip">
                        {part}
                      </span>
                    ))}
                  </span>
                </span>
              </Link>
              <div className="page-card-footer">
                <span className={`product-count ${page.productCount === 0 ? "is-empty" : ""}`}>
                  <Package size={14} aria-hidden />
                  {page.productCount === 0 ? "No products" : `${page.productCount} ${page.productCount === 1 ? "product" : "products"}`}
                </span>
                <div className="row-actions">
                  <a
                    href={`${SITE_URL}${pagePath(page)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="action-button"
                    title="View on the website"
                    aria-label={`View ${page.label} on the website`}
                  >
                    <ExternalLink size={16} aria-hidden />
                  </a>
                  <Link to={`/pages/${page._id}`} className="action-button" title="Edit" aria-label={`Edit ${page.label}`}>
                    <Pencil size={16} aria-hidden />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Toasts toasts={toasts} onClose={removeToast} />
    </div>
  );
}
