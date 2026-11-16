import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ExternalLink,
  FileText,
  FolderTree,
  Gift,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import { BADGES_CHANGED, SITE_URL, api, clearToken } from "../api.js";

const groups = [
  {
    title: null,
    links: [{ to: "/", label: "Overview", icon: LayoutDashboard }],
  },
  {
    title: "Catalog",
    links: [
      { to: "/products", label: "Products", icon: Package },
      { to: "/categories", label: "Categories", icon: FolderTree },
      { to: "/pages", label: "Gift pages", icon: FileText },
    ],
  },
  {
    title: "Marketing",
    links: [
      { to: "/referrals", label: "Referral links", icon: Link2 },
      { to: "/newsletter", label: "Newsletter", icon: Mail },
      { to: "/emails", label: "Emails", icon: Send },
    ],
  },
  {
    title: "Inbox",
    links: [{ to: "/messages", label: "Messages", icon: MessageSquare, badge: "unreadMessages" }],
  },
  {
    title: "Settings",
    links: [{ to: "/content", label: "Site content", icon: SlidersHorizontal }],
  },
];

const COLLAPSED_KEY = "sidebar-collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "yes";
  } catch {
    return false;
  }
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [email, setEmail] = useState("");
  const [badges, setBadges] = useState({});

  useEffect(() => {
    api("/me")
      .then((data) => setEmail(data.admin.email))
      .catch(() => {});
  }, []);

  // Check the unread count again whenever the page changes, or when a page says it changed.
  useEffect(() => {
    function loadBadges() {
      api("/stats/badges")
        .then(setBadges)
        .catch(() => {});
    }
    loadBadges();
    window.addEventListener(BADGES_CHANGED, loadBadges);
    return () => window.removeEventListener(BADGES_CHANGED, loadBadges);
  }, [location.pathname]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "yes" : "no");
    } catch {
      // The choice just won't be remembered next time.
    }
  }

  function logOut() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className={`layout ${collapsed ? "sidebar-is-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden>
            <Gift size={18} />
          </span>
          <span className="brand-text">
            <strong>Gift Site</strong>
            <span>Admin</span>
          </span>
          <button
            type="button"
            className="collapse-button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? <PanelLeftOpen size={18} aria-hidden /> : <PanelLeftClose size={18} aria-hidden />}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Dashboard">
          {groups.map((group) => (
            <div key={group.title ?? "main"} className="nav-group">
              {group.title && <p className="nav-group-title">{group.title}</p>}
              {group.links.map(({ to, label, icon: Icon, badge }) => {
                const count = badge ? badges[badge] : 0;
                return (
                  <NavLink key={to} to={to} end={to === "/"} className="nav-link" title={collapsed ? label : undefined}>
                    <Icon size={18} className="nav-icon" aria-hidden />
                    <span className="nav-label">{label}</span>
                    {count > 0 && (
                      <span className="nav-badge" aria-label={`${count} unread`}>
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a href={SITE_URL} target="_blank" rel="noreferrer" className="nav-link" title={collapsed ? "View website" : undefined}>
            <ExternalLink size={18} className="nav-icon" aria-hidden />
            <span className="nav-label">View website</span>
          </a>
          <div className="profile">
            <span className="profile-avatar" aria-hidden>
              {(email.charAt(0) || "A").toUpperCase()}
            </span>
            <span className="profile-text">
              <strong>Admin</strong>
              <span title={email}>{email}</span>
            </span>
            <button type="button" className="logout-button" onClick={logOut} aria-label="Log out" title="Log out">
              <LogOut size={17} aria-hidden />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
