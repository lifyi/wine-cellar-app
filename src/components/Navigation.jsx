import { NavLink } from 'react-router-dom'

const navItems = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/add',
    label: 'Add Wine',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    to: '/inventory',
    label: 'Inventory',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
]

export default function Navigation() {
  return (
    <>
      {/* Top header bar */}
      <header className="fixed top-0 inset-x-0 z-40 bg-neutral-950/80 backdrop-blur border-b border-neutral-800">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center gap-3">
          <svg className="w-7 h-7 text-wine-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 22h8M12 11v11M7 3h10l1 7a5 5 0 01-5 5h0a5 5 0 01-5-5l1-7z" />
          </svg>
          <span className="text-lg font-semibold tracking-tight">Drinks Stash</span>
        </div>
      </header>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-neutral-950/90 backdrop-blur border-t border-neutral-800 safe-area-pb">
        <div className="max-w-xl mx-auto flex">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors duration-150 ${
                  isActive
                    ? 'text-wine-400'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`
              }
            >
              {icon}
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
