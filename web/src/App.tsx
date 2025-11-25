import { BrowserRouter, Routes, Route } from 'react-router'
import Home from './pages/Home'
import Docs from './pages/Docs'
import Changelog from './pages/Changelog'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/changelog" element={<Changelog />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
