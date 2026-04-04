import { Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation'
import Dashboard from './pages/Dashboard'
import AddWine from './pages/AddWine'
import EditWine from './pages/EditWine'
import Inventory from './pages/Inventory'

export default function App() {
  return (
    <div className="min-h-dvh bg-neutral-950">
      <Navigation />

      {/* Page content — padded away from fixed header and bottom nav */}
      <main className="max-w-xl mx-auto px-4 pt-20 pb-28">
        <Routes>
          <Route
            path="/"
            element={
              <PageWrapper title="Lai's Stash">
                <Dashboard />
              </PageWrapper>
            }
          />
          <Route
            path="/add"
            element={
              <PageWrapper title="Add a Wine">
                <AddWine />
              </PageWrapper>
            }
          />
          <Route
            path="/inventory"
            element={
              <PageWrapper title="Inventory">
                <Inventory />
              </PageWrapper>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <PageWrapper title="Edit Wine">
                <EditWine />
              </PageWrapper>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

function PageWrapper({ title, children }) {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-neutral-100 tracking-tight">{title}</h1>
      {children}
    </div>
  )
}
