import { useEffect, useState } from "react";
import { api } from "../api.js";
import Notice from "../components/Notice.jsx";

const contentInfo = {
  site: "Site name, tagline, description, announcement bar text and contact email",
  mainMenus: "The menus at the top of the website",
  footerColumns: "The link columns in the footer",
  socialLinks: "Social media links in the footer",
  exampleSearches: "Example text that rotates inside the search box",
  popularSearches: "Search buttons shown when the search box opens",
  heroSlides: "The big slides at the top of the homepage",
  heroShortcuts: "The small shortcut tiles above the homepage slides",
  recipients: "Homepage: who are you shopping for",
  collections: "Homepage: curated collections",
  occasions: "Homepage: shop by occasion",
  articles: "Gift guides and stories",
  discoveryVideos: "Homepage: video section",
  finderPeople: "Gift finder: who you are shopping for",
  finderBudgets: "Gift finder: budget choices",
  sections: "Settings for each group of gift pages",
  similarCategories: "Links under 'similar categories' on gift pages",
};

export default function ContentPage() {
  const [items, setItems] = useState([]);
  const [selectedKey, setSelectedKey] = useState("site");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api("/content")
      .then((data) => setItems(data.items))
      .catch((loadError) => setError(loadError.message));
  }, []);

  useEffect(() => {
    const item = items.find((entry) => entry.key === selectedKey);
    setText(item ? JSON.stringify(item.value, null, 2) : "");
  }, [items, selectedKey]);

  async function save() {
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      setError("The text is not valid JSON. Check for missing commas or quotes.");
      setSuccess("");
      return;
    }

    try {
      const data = await api(`/content/${selectedKey}`, { method: "PUT", body: { value } });
      setItems((list) => list.map((entry) => (entry.key === selectedKey ? data.item : entry)));
      setError("");
      setSuccess("Saved. The website will show the change in a moment.");
    } catch (saveError) {
      setError(saveError.message);
      setSuccess("");
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Site content</h1>
      </div>
      <p className="muted intro">Text, menus and homepage blocks. Pick a part of the site and change it below.</p>

      <Notice error={error} success={success} />

      <div className="two-columns narrow-left">
        <div className="card page-list">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`page-list-item ${selectedKey === item.key ? "selected" : ""}`}
              onClick={() => {
                setSelectedKey(item.key);
                setError("");
                setSuccess("");
              }}
            >
              {item.key}
              <span className="muted small block">{contentInfo[item.key] || ""}</span>
            </button>
          ))}
        </div>
        <div className="card">
          <h2>{selectedKey}</h2>
          <p className="muted small">{contentInfo[selectedKey]}</p>
          <textarea className="json-editor" value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} />
          <div className="form-actions">
            <button type="button" className="button" onClick={save}>
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
