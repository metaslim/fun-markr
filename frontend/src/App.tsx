import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { TestList } from './pages/TestList';
import { TestDetail } from './pages/TestDetail';
import { TestStudents } from './pages/TestStudents';
import { StudentList } from './pages/StudentList';
import { StudentDetail } from './pages/StudentDetail';
import { Import } from './pages/Import';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/tests" element={<Layout><TestList /></Layout>} />
        <Route path="/tests/:testId" element={<Layout><TestDetail /></Layout>} />
        <Route path="/tests/:testId/students" element={<Layout><TestStudents /></Layout>} />
        <Route path="/students" element={<Layout><StudentList /></Layout>} />
        <Route path="/students/:studentNumber" element={<Layout><StudentDetail /></Layout>} />
        <Route path="/import" element={<Layout><Import /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
