import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Embed } from './pages/Embed'
import Debug from './pages/Debug'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/embed" element={<Embed />} />
        <Route path="/debug" element={<Debug />} />
        <Route path="/" element={<Embed />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
