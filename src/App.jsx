import { Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./api.js";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import OverviewPage from "./pages/OverviewPage.jsx";
import ProductsPage from "./pages/ProductsPage.jsx";
import ProductFormPage from "./pages/ProductFormPage.jsx";
import CategoriesPage from "./pages/CategoriesPage.jsx";
import ReferralLinksPage from "./pages/ReferralLinksPage.jsx";
import NewsletterPage from "./pages/NewsletterPage.jsx";
import MessagesPage from "./pages/MessagesPage.jsx";
import PagesPage from "./pages/PagesPage.jsx";
import GiftPageEditorPage from "./pages/GiftPageEditorPage.jsx";
import ContentPage from "./pages/ContentPage.jsx";
import EmailsPage from "./pages/EmailsPage.jsx";
import EmailComposerPage from "./pages/EmailComposerPage.jsx";

function NeedsLogin({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <NeedsLogin>
            <Layout />
          </NeedsLogin>
        }
      >
        <Route path="/" element={<OverviewPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/new" element={<ProductFormPage key="new" />} />
        <Route path="/products/:id" element={<ProductFormPage key="edit" />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/referrals" element={<ReferralLinksPage />} />
        <Route path="/newsletter" element={<NewsletterPage />} />
        <Route path="/emails" element={<EmailsPage />} />
        <Route path="/emails/new" element={<EmailComposerPage key="new" />} />
        <Route path="/emails/:id" element={<EmailComposerPage key="edit" />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/pages" element={<PagesPage />} />
        <Route path="/pages/new" element={<GiftPageEditorPage key="new" />} />
        <Route path="/pages/:id" element={<GiftPageEditorPage key="edit" />} />
        <Route path="/content" element={<ContentPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
