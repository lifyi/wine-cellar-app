import { NavLink } from 'react-router-dom'

const navItems = [
  {
    to: '/',
    label: 'Home',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/add',
    label: 'Add',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    to: '/inventory',
    label: 'Cellar',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    to: '/pair',
    label: 'Pair',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 9h4a2 2 0 002-2V3M9 21V9M21 3v4a2 2 0 01-2 2h-4M15 9v12" />
      </svg>
    ),
  },
  {
    to: '/wishlist',
    label: 'Wishlist',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    to: '/history',
    label: 'History',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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

      {/* Bottom tab bar — scrollable to fit 6 tabs cleanly */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-neutral-950/90 backdrop-blur border-t border-neutral-800 safe-area-pb">
        <div className="max-w-xl mx-auto overflow-x-auto scrollbar-none">
          <div className="flex">
            {navItems.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex-1 min-w-[3.5rem] flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors duration-150 ${
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
        </div>
      </nav>
    </>
  )
}
