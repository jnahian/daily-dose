import { Routes, Route, useLocation } from 'react-router';
import { AnimatePresence } from 'framer-motion';
import Home from './pages/Home';
import Docs from './pages/Docs';
import Changelog from './pages/Changelog';
import Scripts from './pages/Scripts';
import { ThemeProvider } from './context/ThemeContext';
import PageTransition from './components/PageTransition';
import { Navbar } from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';

function App() {
  const location = useLocation();

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ScrollToTop />
      <Navbar />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/docs" element={<PageTransition><Docs /></PageTransition>} />
          <Route path="/changelog" element={<PageTransition><Changelog /></PageTransition>} />
          <Route path="/scripts" element={<PageTransition><Scripts /></PageTransition>} />
        </Routes>
      </AnimatePresence>
    </ThemeProvider>
  );
}

export default App;
