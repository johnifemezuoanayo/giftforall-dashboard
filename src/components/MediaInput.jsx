import { useRef, useState } from "react";
import { ImagePlus, Link2, LoaderCircle, RefreshCw, Trash2, Video } from "lucide-react";
import { sizedImageUrl, uploadFile } from "../api.js";

// A drop zone for a photo or video. People can drop a file, pick one, or paste a link.
export default function MediaInput({ id, label, hint, value, onChange, kind = "image", error }) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showLink, setShowLink] = useState(false);
  const isVideo = kind === "video";
  const accept = isVideo ? "video/mp4" : "image/jpeg,image/png,image/webp,image/gif";

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      onChange(await uploadFile(file));
    } catch (problem) {
      setUploadError(problem.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files[0]);
  }

  const shownError = uploadError || error;

  return (
    <div className="media-input">
      <div className="media-label-row">
        <span className="field-title" id={`${id}-label`}>
          {label}
        </span>
        {value && (
          <button type="button" className="text-button" onClick={() => setShowLink(!showLink)}>
            <Link2 size={14} aria-hidden /> {showLink ? "Hide link" : "Edit link"}
          </button>
        )}
      </div>

      {value ? (
        <div className="media-preview">
          {isVideo ? (
            <video src={value} muted controls className="media-preview-file" />
          ) : (
            <img src={sizedImageUrl(value, 600)} alt="" className="media-preview-file" />
          )}
          <div className="media-preview-actions">
            <button type="button" className="media-action" onClick={() => fileRef.current.click()} disabled={uploading}>
              {uploading ? <LoaderCircle size={15} className="spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />}
              Replace
            </button>
            <button type="button" className="media-action is-danger" onClick={() => onChange("")}>
              <Trash2 size={15} aria-hidden /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`drop-zone ${dragging ? "is-dragging" : ""} ${shownError ? "has-error" : ""}`}
          onClick={() => fileRef.current.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          aria-labelledby={`${id}-label`}
          aria-describedby={hint ? `${id}-hint` : undefined}
          disabled={uploading}
        >
          <span className="drop-icon" aria-hidden>
            {uploading ? <LoaderCircle size={22} className="spin" /> : isVideo ? <Video size={22} /> : <ImagePlus size={22} />}
          </span>
          <span className="drop-title">{uploading ? "Uploading…" : `Drop a ${isVideo ? "video" : "photo"} here or click to upload`}</span>
          <span className="drop-hint">{isVideo ? "MP4, up to 25 MB" : "JPG, PNG, WEBP or GIF, up to 25 MB"}</span>
        </button>
      )}

      {(!value || showLink) && (
        <div className="input-with-icon media-link">
          <Link2 size={15} aria-hidden />
          <input
            id={id}
            type="url"
            value={value}
            onChange={(event) => onChange(event.target.value.trim())}
            placeholder={`…or paste a ${isVideo ? "video" : "photo"} link`}
            aria-labelledby={`${id}-label`}
            aria-invalid={Boolean(shownError)}
          />
        </div>
      )}

      {hint && !shownError && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {shownError && <p className="field-error">{shownError}</p>}

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          handleFile(event.target.files[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
