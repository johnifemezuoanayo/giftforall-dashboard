import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Flame,
  LayoutGrid,
  List,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api, thumbUrl } from "../api.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Switch from "../components/Switch.jsx";
import { Toasts, useToastFromNavigation, useToasts } from "../components/Toasts.jsx";

const PAGE_SIZE = 20;
const VIEW_KEY = "products-view";

const statusTabs = [
  { id: "all", label: "All", test: () => true },
  { id: "live", label: "Live", test: (product) => product.active },
  { id: "hidden", label: "Hidden", test: (product) => !product.active },
  { id: "trending", label: "Trending", test: (product) => product.trending },
  { id: "uncategorized", label: "No category", test: (product) => product.categories.length === 0 },
  { id: "sample", label: "Sample price", test: (product) => product.isSampleData },
];

const sortOptions = [
  { id: "order", label: "List order", compare: (a, b) => a.position - b.position },
  { id: "newest", label: "Newest first", compare: (a, b) => b.position - a.position },
  { id: "name", label: "Name A–Z", compare: (a, b) => a.name.localeCompare(b.name) },
  { id: "price-low", label: "Price: low to high", compare: (a, b) => a.price.amount - b.price.amount },
  { id: "price-high", label: "Price: high to low", compare: (a, b) => b.price.amount - a.price.amount },
  { id: "clicks", label: "Most clicked", compare: (a, b) => b.clicks - a.clicks },
];

const shops = {
  amazon: { name: "Amazon", color: "var(--series-1)" },
  temu: { name: "Temu", color: "var(--series-2)" },
};

const bulkLabels = {
  show: "Show on site",
  hide: "Hide from site",
  trend: "Mark as trending",
  untrend: "Remove from trending",
};

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "table";
  } catch {
    return "table";
  }
}

function formatPrice(amount) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amount);
}

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState(readView);
  const [selected, setSelected] = useState(new Set());
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toasts, showToast, removeToast } = useToasts();
  useToastFromNavigation(showToast);

  const status = statusTabs.some((tab) => tab.id === searchParams.get("status")) ? searchParams.get("status") : "all";
  const search = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const shop = searchParams.get("shop") || "";
  const sort = sortOptions.some((option) => option.id === searchParams.get("sort")) ? searchParams.get("sort") : "order";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [searchInput, setSearchInput] = useState(search);

  function setFilter(name, value) {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "all" && !(name === "sort" && value === "order")) next.set(name, value);
    else next.delete(name);
    if (name !== "page") next.delete("page");
    setSearchParams(next, { replace: true });
  }

  async function loadProducts() {
    try {
      const data = await api("/products");
      setProducts(data.products);
      setLoadError("");
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  // Copy the search text into the page address after a short pause, so typing stays smooth.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) setFilter("q", searchInput);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadProducts();
    api("/categories")
      .then((data) => setCategories(data.categories))
      .catch(() => {});
  }, []);

  const categoryNames = useMemo(() => {
    const names = {};
    categories.forEach((item) => {
      names[item.slug] = item.label;
    });
    return names;
  }, [categories]);

  const searchText = searchInput.trim().toLowerCase();
  const matchesFilters = (product) => {
    if (category && !product.categories.includes(category)) return false;
    if (shop && product.retailer !== shop) return false;
    if (!searchText) return true;
    const text = [product.name, product.slug, product.badge, ...product.categories.map((slug) => categoryNames[slug] || slug)]
      .join(" ")
      .toLowerCase();
    return text.includes(searchText);
  };

  const filtered = products.filter(matchesFilters);
  const tabCounts = Object.fromEntries(statusTabs.map((tab) => [tab.id, filtered.filter(tab.test).length]));
  const sortCompare = sortOptions.find((option) => option.id === sort).compare;
  const results = filtered.filter(statusTabs.find((tab) => tab.id === status).test).sort(sortCompare);
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = Boolean(searchText || category || shop || status !== "all");

  const allOnPageSelected = pageItems.length > 0 && pageItems.every((product) => selected.has(product._id));

  function toggleSelected(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePageSelection() {
    setSelected((current) => {
      const next = new Set(current);
      pageItems.forEach((product) => (allOnPageSelected ? next.delete(product._id) : next.add(product._id)));
      return next;
    });
  }

  async function quickChange(product, field, value) {
    setProducts((list) => list.map((item) => (item._id === product._id ? { ...item, [field]: value } : item)));
    try {
      await api(`/products/${product._id}`, { method: "PATCH", body: { [field]: value } });
      const what = field === "active" ? (value ? "is now on the site" : "is now hidden") : value ? "is now trending" : "is no longer trending";
      showToast(`"${product.name}" ${what}.`);
    } catch (error) {
      setProducts((list) => list.map((item) => (item._id === product._id ? { ...item, [field]: !value } : item)));
      showToast(error.message, "error");
    }
  }

  async function runBulk(action) {
    setBusy(true);
    try {
      const data = await api("/products/bulk", { method: "POST", body: { ids: [...selected], action } });
      showToast(data.message);
      setSelected(new Set());
      setConfirm(null);
      await loadProducts();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(product) {
    setBusy(true);
    try {
      await api(`/products/${product._id}`, { method: "DELETE" });
      setProducts((list) => list.filter((item) => item._id !== product._id));
      setSelected((current) => {
        const next = new Set(current);
        next.delete(product._id);
        return next;
      });
      showToast(`"${product.name}" was deleted.`);
      setConfirm(null);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyReferral(product) {
    try {
      await navigator.clipboard.writeText(product.referralUrl);
      showToast("Referral link copied.");
    } catch {
      showToast("Could not copy. The link is on the product's edit page.", "error");
    }
  }

  function pickView(next) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // The choice just won't be remembered next time.
    }
  }

  function askDeleteOne(product) {
    setConfirm({
      title: `Delete "${product.name}"?`,
      message: "It will be removed from the website, along with its referral link and click history. This can't be undone.",
      onConfirm: () => deleteOne(product),
    });
  }

  function askDeleteSelected() {
    setConfirm({
      title: `Delete ${selected.size} ${selected.size === 1 ? "product" : "products"}?`,
      message: "They will be removed from the website, along with their referral links and click history. This can't be undone.",
      onConfirm: () => runBulk("delete"),
    });
  }

  const rowProps = {
    categoryNames,
    selected,
    onSelect: toggleSelected,
    onQuickChange: quickChange,
    onCopy: copyReferral,
    onDelete: askDeleteOne,
  };

  return (
    <div className={`products-page ${selected.size > 0 ? "has-bulk-bar" : ""}`}>
      <div className="page-header">
        <div>
          <h1>Products</h1>
          <p className="muted page-subtitle">
            {loading ? "Loading…" : `${products.length} products · ${products.filter((item) => item.active).length} on the site`}
          </p>
        </div>
        <Link to="/products/new" className="button">
          <Plus size={16} aria-hidden /> Add product
        </Link>
      </div>

      {loadError && <p className="notice notice-error">{loadError}</p>}

      <div className="status-tabs" role="tablist" aria-label="Filter by status">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={status === tab.id}
            className={`status-tab ${status === tab.id ? "is-selected" : ""}`}
            onClick={() => setFilter("status", tab.id)}
          >
            {tab.label}
            <span className="status-count">{tabCounts[tab.id]}</span>
          </button>
        ))}
      </div>

      <div className="products-toolbar">
        <label className="search-field">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search products</span>
          <input
            type="search"
            placeholder="Search by name, category or badge…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          {searchInput && (
            <button type="button" onClick={() => setSearchInput("")} aria-label="Clear search">
              <X size={14} aria-hidden />
            </button>
          )}
        </label>
        <select value={category} onChange={(event) => setFilter("category", event.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item._id} value={item.slug}>
              {item.label}
            </option>
          ))}
        </select>
        <select value={shop} onChange={(event) => setFilter("shop", event.target.value)} aria-label="Shop">
          <option value="">All shops</option>
          <option value="amazon">Amazon</option>
          <option value="temu">Temu</option>
        </select>
        <select value={sort} onChange={(event) => setFilter("sort", event.target.value)} aria-label="Sort">
          {sortOptions.map((option) => (
            <option key={option.id} value={option.id}>
              Sort: {option.label}
            </option>
          ))}
        </select>
        <div className="view-toggle" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "table"} onClick={() => pickView("table")} title="Table view">
            <List size={16} aria-hidden />
            <span className="sr-only">Table view</span>
          </button>
          <button type="button" aria-pressed={view === "grid"} onClick={() => pickView("grid")} title="Grid view">
            <LayoutGrid size={16} aria-hidden />
            <span className="sr-only">Grid view</span>
          </button>
        </div>
      </div>

      {!loading && results.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon" aria-hidden>
            <PackageOpen size={28} />
          </span>
          <h2>{hasFilters ? "No products match" : "No products yet"}</h2>
          <p className="muted">{hasFilters ? "Try another search or clear the filters." : "Add your first product to get started."}</p>
          {hasFilters ? (
            <button type="button" className="button button-light" onClick={() => {
                setSearchInput("");
                setSearchParams({}, { replace: true });
              }}>
              Clear filters
            </button>
          ) : (
            <Link to="/products/new" className="button">
              <Plus size={16} aria-hidden /> Add product
            </Link>
          )}
        </div>
      ) : view === "table" ? (
        <div className="card table-card product-table-card">
          <table className="product-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input type="checkbox" checked={allOnPageSelected} onChange={togglePageSelection} aria-label="Select all on this page" />
                </th>
                <th>Product</th>
                <th>Price</th>
                <th>Shop</th>
                <th>Categories</th>
                <th className="right">Clicks</th>
                <th className="center">Trending</th>
                <th className="center">Live</th>
                <th className="right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((product) => (
                <ProductRow key={product._id} product={product} {...rowProps} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="product-grid">
          {pageItems.map((product) => (
            <ProductCard key={product._id} product={product} {...rowProps} />
          ))}
        </ul>
      )}

      {results.length > PAGE_SIZE && (
        <nav className="pagination" aria-label="Pages">
          <span className="muted small">
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, results.length)} of {results.length}
          </span>
          <div className="pagination-buttons">
            <button type="button" className="icon-button" disabled={currentPage === 1} onClick={() => setFilter("page", currentPage - 1)}>
              <ChevronLeft size={16} aria-hidden /> Previous
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
              <button
                key={number}
                type="button"
                className={`page-number ${number === currentPage ? "is-current" : ""}`}
                aria-current={number === currentPage ? "page" : undefined}
                onClick={() => setFilter("page", number)}
              >
                {number}
              </button>
            ))}
            <button
              type="button"
              className="icon-button"
              disabled={currentPage === pageCount}
              onClick={() => setFilter("page", currentPage + 1)}
            >
              Next <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </nav>
      )}

      {selected.size > 0 && (
        <div className="bulk-bar" role="region" aria-label="Actions for selected products">
          <span className="bulk-count">{selected.size} selected</span>
          <div className="bulk-actions">
            {Object.entries(bulkLabels).map(([action, label]) => (
              <button key={action} type="button" onClick={() => runBulk(action)} disabled={busy}>
                {label}
              </button>
            ))}
            <button type="button" className="bulk-delete" onClick={askDeleteSelected} disabled={busy}>
              <Trash2 size={15} aria-hidden /> Delete
            </button>
          </div>
          <button type="button" className="bulk-close" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <X size={16} aria-hidden />
          </button>
        </div>
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

function ShopChip({ retailer }) {
  const info = shops[retailer] || { name: retailer, color: "var(--series-other)" };
  return (
    <span className="shop-chip">
      <span className="shop-dot" style={{ background: info.color }} aria-hidden />
      {info.name}
    </span>
  );
}

function CategoryChips({ product, categoryNames }) {
  if (product.categories.length === 0) return <span className="chip chip-warning">No category</span>;
  const shown = product.categories.slice(0, 2);
  const extra = product.categories.length - shown.length;
  return (
    <span className="chip-list">
      {shown.map((slug) => (
        <span key={slug} className="chip">
          {categoryNames[slug] || slug}
        </span>
      ))}
      {extra > 0 && (
        <span className="chip chip-more" title={product.categories.slice(2).map((slug) => categoryNames[slug] || slug).join(", ")}>
          +{extra}
        </span>
      )}
    </span>
  );
}

function RowActions({ product, onCopy, onDelete }) {
  return (
    <div className="row-actions">
      <Link to={`/products/${product._id}`} className="action-button" title="Edit" aria-label={`Edit ${product.name}`}>
        <Pencil size={16} aria-hidden />
      </Link>
      <button type="button" className="action-button" onClick={() => onCopy(product)} title="Copy referral link" aria-label={`Copy referral link for ${product.name}`}>
        <Copy size={16} aria-hidden />
      </button>
      <a
        href={product.affiliateUrl}
        target="_blank"
        rel="noreferrer"
        className="action-button"
        title="Open shop page"
        aria-label={`Open the shop page for ${product.name}`}
      >
        <ExternalLink size={16} aria-hidden />
      </a>
      <button
        type="button"
        className="action-button is-danger"
        onClick={() => onDelete(product)}
        title="Delete"
        aria-label={`Delete ${product.name}`}
      >
        <Trash2 size={16} aria-hidden />
      </button>
    </div>
  );
}

function ProductRow({ product, categoryNames, selected, onSelect, onQuickChange, onCopy, onDelete }) {
  const isSelected = selected.has(product._id);
  return (
    <tr className={`${product.active ? "" : "is-hidden"} ${isSelected ? "is-selected" : ""}`}>
      <td className="col-check">
        <input type="checkbox" checked={isSelected} onChange={() => onSelect(product._id)} aria-label={`Select ${product.name}`} />
      </td>
      <td>
        <div className="product-cell">
          <img src={thumbUrl(product.image.src)} alt="" className="product-thumb" loading="lazy" />
          <div className="product-cell-text">
            <Link to={`/products/${product._id}`} className="product-name">
              {product.name}
            </Link>
            <span className="product-meta">
              /{product.slug}
              {product.badge && <span className="badge-pill">{product.badge}</span>}
              {!product.active && (
                <span className="hidden-pill">
                  <EyeOff size={12} aria-hidden /> Hidden
                </span>
              )}
            </span>
          </div>
        </div>
      </td>
      <td className="price-cell">
        {formatPrice(product.price.amount)}
        {product.isSampleData && <span className="sample-note">sample</span>}
      </td>
      <td>
        <ShopChip retailer={product.retailer} />
      </td>
      <td>
        <CategoryChips product={product} categoryNames={categoryNames} />
      </td>
      <td className="right tabular">{product.clicks}</td>
      <td className="center">
        <Switch checked={product.trending} onChange={(value) => onQuickChange(product, "trending", value)} label={`Trending: ${product.name}`} />
      </td>
      <td className="center">
        <Switch checked={product.active} onChange={(value) => onQuickChange(product, "active", value)} label={`Show on site: ${product.name}`} />
      </td>
      <td className="right">
        <RowActions product={product} onCopy={onCopy} onDelete={onDelete} />
      </td>
    </tr>
  );
}

function ProductCard({ product, categoryNames, selected, onSelect, onQuickChange, onCopy, onDelete }) {
  const isSelected = selected.has(product._id);
  return (
    <li className={`product-card ${product.active ? "" : "is-hidden"} ${isSelected ? "is-selected" : ""}`}>
      <div className="product-card-image">
        <img src={thumbUrl(product.image.src)} alt="" loading="lazy" />
        <input
          type="checkbox"
          className="card-check"
          checked={isSelected}
          onChange={() => onSelect(product._id)}
          aria-label={`Select ${product.name}`}
        />
        <div className="card-flags">
          {product.trending && (
            <span className="card-flag">
              <Flame size={12} aria-hidden /> Trending
            </span>
          )}
          {!product.active && (
            <span className="card-flag is-dark">
              <EyeOff size={12} aria-hidden /> Hidden
            </span>
          )}
        </div>
      </div>
      <div className="product-card-body">
        <div className="product-card-top">
          <ShopChip retailer={product.retailer} />
          <span className="muted small tabular">{product.clicks} clicks</span>
        </div>
        <Link to={`/products/${product._id}`} className="product-name">
          {product.name}
        </Link>
        <p className="price-cell">
          {formatPrice(product.price.amount)}
          {product.isSampleData && <span className="sample-note">sample</span>}
        </p>
        <CategoryChips product={product} categoryNames={categoryNames} />
      </div>
      <div className="product-card-footer">
        <label className="switch-label">
          <Switch checked={product.active} onChange={(value) => onQuickChange(product, "active", value)} label={`Show on site: ${product.name}`} />
          <Eye size={14} aria-hidden /> Live
        </label>
        <label className="switch-label">
          <Switch checked={product.trending} onChange={(value) => onQuickChange(product, "trending", value)} label={`Trending: ${product.name}`} />
          <Flame size={14} aria-hidden /> Trending
        </label>
        <RowActions product={product} onCopy={onCopy} onDelete={onDelete} />
      </div>
    </li>
  );
}
