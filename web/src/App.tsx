import { Routes, Route } from 'react-router';
import Home from './pages/Home';
import Docs from './pages/Docs';
import Changelog from './pages/Changelog';
import Scripts from './pages/Scripts';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/scripts" element={<Scripts />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
