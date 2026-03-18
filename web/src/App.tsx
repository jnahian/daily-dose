import { Suspense, lazy } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router';
import { AnimatePresence } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext';
import PageTransition from './components/PageTransition';
import { Navbar } from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import Loading from './components/Loading';
import { AdminLayout } from './components/admin/AdminLayout';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const Docs = lazy(() => import('./pages/Docs'));
const Changelog = lazy(() => import('./pages/Changelog'));
const Scripts = lazy(() => import('./pages/Scripts'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const ContactPage = lazy(() => import('./pages/ContactPage'));

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

function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

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
            <Route path="/" element={<PageTransition><Home /></PageTransition>} />
            <Route path="/docs" element={<PageTransition><Docs /></PageTransition>} />
            <Route path="/changelog" element={<PageTransition><Changelog /></PageTransition>} />
            <Route path="/scripts" element={<PageTransition><Scripts /></PageTransition>} />
            <Route path="/privacy" element={<PageTransition><PrivacyPolicy /></PageTransition>} />
            <Route path="/terms" element={<PageTransition><TermsOfService /></PageTransition>} />
            <Route path="/contact" element={<PageTransition><ContactPage /></PageTransition>} />
          </Routes>
        </Suspense>
      </AnimatePresence>
    </ThemeProvider>
  );
}

export default App;
