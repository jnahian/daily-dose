import { Suspense, lazy } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "./context/ThemeContext";
import PageTransition from "./components/PageTransition";
import { Navbar } from "./components/Navbar";
import ScrollToTop from "./components/ScrollToTop";
import Loading from "./components/Loading";
import { AdminLayout } from "./components/admin/AdminLayout";

// Lazy load pages
const Home = lazy(() => import("./pages/Home"));
const HomeV1 = lazy(() => import("./pages/HomeV1"));
const Docs = lazy(() => import("./pages/Docs"));
const McpDocs = lazy(() => import("./pages/McpDocs"));
const Changelog = lazy(() => import("./pages/Changelog"));
const Scripts = lazy(() => import("./pages/Scripts"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const McpTokens = lazy(() => import("./pages/McpTokens"));

// Lazy load admin pages
const AdminLogin = lazy(() => import('./pages/admin/Login'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminOrganizations = lazy(() => import('./pages/admin/Organizations'));
const AdminTeams = lazy(() => import('./pages/admin/Teams'));
const AdminMembers = lazy(() => import('./pages/admin/Members'));
const AdminStandups = lazy(() => import('./pages/admin/Standups'));
const AdminHolidays = lazy(() => import('./pages/admin/Holidays'));
const AdminScheduler = lazy(() => import('./pages/admin/Scheduler'));
const AdminActivity = lazy(() => import('./pages/admin/Activity'));
const AdminTokens = lazy(() => import('./pages/admin/Tokens'));

function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname === '/admin' || location.pathname.startsWith('/admin/');

  if (isAdminRoute) {
    return (
      <Suspense fallback={<Loading />}>
        <Routes location={location}>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="organizations" element={<AdminOrganizations />} />
            <Route path="teams" element={<AdminTeams />} />
            <Route path="members" element={<AdminMembers />} />
            <Route path="standups" element={<AdminStandups />} />
            <Route path="holidays" element={<AdminHolidays />} />
            <Route path="scheduler" element={<AdminScheduler />} />
            <Route path="activity" element={<AdminActivity />} />
            <Route path="tokens" element={<AdminTokens />} />
          </Route>
        </Routes>
      </Suspense>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ScrollToTop />
      <Navbar />
      <AnimatePresence mode="wait">
        <Suspense fallback={<Loading />}>
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                <PageTransition>
                  <Home />
                </PageTransition>
              }
            />
            <Route
              path="/v1"
              element={
                <PageTransition>
                  <HomeV1 />
                </PageTransition>
              }
            />
            <Route
              path="/docs"
              element={
                <PageTransition>
                  <Docs />
                </PageTransition>
              }
            />
            <Route
              path="/docs/mcp"
              element={
                <PageTransition>
                  <McpDocs />
                </PageTransition>
              }
            />
            <Route
              path="/changelog"
              element={
                <PageTransition>
                  <Changelog />
                </PageTransition>
              }
            />
            <Route
              path="/scripts"
              element={
                <PageTransition>
                  <Scripts />
                </PageTransition>
              }
            />
            <Route
              path="/privacy"
              element={
                <PageTransition>
                  <PrivacyPolicy />
                </PageTransition>
              }
            />
            <Route
              path="/terms"
              element={
                <PageTransition>
                  <TermsOfService />
                </PageTransition>
              }
            />
            <Route
              path="/contact"
              element={
                <PageTransition>
                  <ContactPage />
                </PageTransition>
              }
            />
            <Route
              path="/mcp-tokens"
              element={
                <PageTransition>
                  <McpTokens />
                </PageTransition>
              }
            />
          </Routes>
        </Suspense>
      </AnimatePresence>
    </ThemeProvider>
  );
}

export default App;
