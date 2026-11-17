/** Primary navigation. `filters` = page uses the global card/period filters. */
export const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: 'overview', end: true, filters: true, primary: true },
  { to: '/transactions', label: 'Transactions', icon: 'transactions', filters: true, primary: true },
  { to: '/analytics', label: 'Insights', icon: 'insights', filters: true, primary: true },
  { to: '/statements', label: 'Statements', icon: 'statements', filters: false, primary: false },
  { to: '/categories', label: 'Categories', icon: 'categories', filters: false, primary: false },
];

export function navItemFor(pathname) {
  return NAV_ITEMS.find(item => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
    || NAV_ITEMS[0];
}
