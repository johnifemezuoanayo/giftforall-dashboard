import { useEffect, useState } from "react";
import { api, thumbUrl } from "../api.js";
import ImageInput from "../components/ImageInput.jsx";
import Notice from "../components/Notice.jsx";

const emptyForm = { label: "", slug: "", image: { src: "", alt: "" }, active: true };

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadCategories() {
    try {
      const data = await api("/categories");
      setCategories(data.categories);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function startEdit(category) {
    setEditingId(category._id);
    setForm({ label: category.label, slug: category.slug, image: category.image, active: category.active });
    setError("");
    setSuccess("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      if (editingId) {
        await api(`/categories/${editingId}`, { method: "PUT", body: form });
        setSuccess("Category updated.");
      } else {
        await api("/categories", { method: "POST", body: form });
        setSuccess("Category added.");
      }
      cancelEdit();
      loadCategories();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function deleteCategory(category) {
    const message =
      category.productCount > 0
        ? `Delete "${category.label}"? It will be removed from ${category.productCount} products.`
        : `Delete "${category.label}"?`;
    if (!window.confirm(message)) return;
    try {
      await api(`/categories/${category._id}`, { method: "DELETE" });
      setSuccess("Category deleted.");
      loadCategories();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Categories</h1>
      </div>
      <p className="muted intro">
        Categories show up as the "shop by interest" tiles, in the filters on gift pages and in the gift finder.
      </p>

      <Notice error={error} success={success} />

      <div className="two-columns wide-left">
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Link name</th>
                <th>Products</th>
                <th>Live</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category._id} className={category.active ? "" : "faded"}>
                  <td>{category.image.src && <img src={thumbUrl(category.image.src)} alt="" className="thumb" />}</td>
                  <td className="strong">{category.label}</td>
                  <td className="small">{category.slug}</td>
                  <td>{category.productCount}</td>
                  <td>{category.active ? "Yes" : "No"}</td>
                  <td className="right nowrap">
                    <button type="button" className="button button-small button-light" onClick={() => startEdit(category)}>
                      Edit
                    </button>{" "}
                    <button type="button" className="button button-small button-danger" onClick={() => deleteCategory(category)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {categories.length === 0 && <p className="empty">No categories yet.</p>}
        </div>

        <form className="card" onSubmit={handleSubmit}>
          <h2>{editingId ? "Edit category" : "Add category"}</h2>
          <div className="field">
            <label htmlFor="label">Name *</label>
            <input id="label" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} required />
          </div>
          <div className="field">
            <label htmlFor="slug">Link name (slug)</label>
            <input
              id="slug"
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
              placeholder="Made from the name if left empty"
            />
          </div>
          <ImageInput label="Image" value={form.image.src} onChange={(src) => setForm({ ...form, image: { ...form.image, src } })} />
          <div className="field">
            <label htmlFor="alt">Image description</label>
            <input
              id="alt"
              value={form.image.alt}
              onChange={(event) => setForm({ ...form, image: { ...form.image, alt: event.target.value } })}
            />
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            Show on the website
          </label>
          <div className="form-actions">
            <button type="submit" className="button">
              {editingId ? "Save changes" : "Add category"}
            </button>
            {editingId && (
              <button type="button" className="button button-light" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
