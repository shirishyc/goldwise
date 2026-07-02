import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import FinderPage from './pages/FinderPage';
import ComparePage from './pages/ComparePage';
import PulsePage from './pages/PulsePage';
import CalculatorPage from './pages/CalculatorPage';
import AboutPage from './pages/AboutPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/finder" element={<FinderPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/pulse" element={<PulsePage />} />
        <Route path="/calculator" element={<CalculatorPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Route>
    </Routes>
  );
}
