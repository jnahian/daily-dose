import { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router';
import { AnimatePresence } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext';
import PageTransition from './components/PageTransition';
import { Navbar } from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import Loading from './components/Loading';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const Docs = lazy(() => import('./pages/Docs'));
const Changelog = lazy(() => import('./pages/Changelog'));
const Scripts = lazy(() => import('./pages/Scripts'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const ContactPage = lazy(() => import('./pages/ContactPage'));

function App() {
  const location = useLocation();

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
