import { Routes, Route } from 'react-router-dom';
import NotFound from './pages/NotFound';

function Home() {
  return <h1 className="p-8 text-3xl font-bold text-emerald-600">SplitEase</h1>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
