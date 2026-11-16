import { useState } from "react";
import { uploadFile } from "../api.js";

// A text box for an image link, with a button to upload a file instead.
export default function ImageInput({ label, value, onChange, accept = "image/*", required = false }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadFile(file);
      onChange(url);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  const isVideo = accept.startsWith("video");

  return (
    <div className="field">
      <label>{label}</label>
      <div className="image-input">
        <input
          type="url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://..."
          required={required}
        />
        <label className="button button-light upload-button">
          {uploading ? "Uploading…" : "Upload"}
          <input type="file" accept={accept} onChange={handleFile} hidden />
        </label>
      </div>
      {error && <p className="field-error">{error}</p>}
      {value && !isVideo && <img src={value} alt="" className="image-preview" />}
    </div>
  );
}
