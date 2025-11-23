import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Home } from './pages/Home'
import { UserGuide } from './pages/Documentation/UserGuide'
import { Scripts } from './pages/Documentation/Scripts'
import { Changelog } from './pages/Changelog'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="documentation">
            <Route path="user-guide" element={<UserGuide />} />
            <Route path="scripts" element={<Scripts />} />
          </Route>
          <Route path="changelog" element={<Changelog />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
