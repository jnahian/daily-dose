import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import Docs from './pages/Docs'
import Changelog from './pages/Changelog'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/changelog" element={<Changelog />} />
    </Routes>
  )
}

export default App
