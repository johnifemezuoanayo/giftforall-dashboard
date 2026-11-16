export default function Notice({ error, success }) {
  if (error) return <p className="notice notice-error">{error}</p>;
  if (success) return <p className="notice notice-success">{success}</p>;
  return null;
}
