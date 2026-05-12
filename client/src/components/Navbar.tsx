import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Terminal,
  Globe,
  Code2,
  Network,
  Binary,
  Webhook,
  BookOpen,
  Link2,
  Gauge,
  Mail,
  Menu,
  X,
} from 'lucide-react';

type TabId =
  | 'terminal'
  | 'api'
  | 'dev-tools'
  | 'network'
  | 'encoders'
  | 'webhook'
  | 'tempmail'
  | 'guide'
  | 'clipsync'
  | 'rate-limit'
  | 'url-shortener'
  | 'email-designer';

interface NavTab {
  id: TabId;
  label: string;
  icon: any;
  path: string;
}

const NAV_TABS: NavTab[] = [
  { id: 'terminal', label: 'Terminal', icon: Terminal, path: '/' },
  { id: 'api', label: 'API Tester', icon: Globe, path: '/api-tester' },
  { id: 'dev-tools', label: 'Dev Tools', icon: Code2, path: '/dev-tools' },
  { id: 'network', label: 'Network', icon: Network, path: '/network' },
  { id: 'encoders', label: 'Encoders', icon: Binary, path: '/encoders' },
  { id: 'rate-limit', label: 'Rate Limit', icon: Gauge, path: '/rate-limit' },
  { id: 'webhook', label: 'Webhooks', icon: Webhook, path: '/webhook' },
  { id: 'url-shortener', label: 'URL Shortener', icon: Link2, path: '/url-shortener' },
  { id: 'clipsync', label: 'ClipSync', icon: Link2, path: '/clip-sync' },
  { id: 'tempmail', label: 'TempMail', icon: Mail, path: 'https://tempmail.fairarena.app' },
  { id: 'guide', label: 'Guide', icon: BookOpen, path: '/guide' },
  { id: 'email-designer', label: 'Email Designer', icon: Mail, path: '/email-designer' },
];

export function Navbar() {
  const location = useLocation();
  const [hoveredTab, setHoveredTab] = useState<TabId | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const navRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  const [indicator, setIndicator] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });

  // Determine active tab based on path
  const activeTabId = NAV_TABS.find(tab => 
    tab.path !== '/' && location.pathname.startsWith(tab.path)
  )?.id || (location.pathname === '/' ? 'terminal' : null);

  const currentTab = hoveredTab || activeTabId;

  const updateIndicator = useCallback(() => {
    if (!currentTab) {
      setIndicator(prev => ({ ...prev, opacity: 0 }));
      return;
    }

    const node = tabRefs.current[currentTab];
    const navNode = navRef.current;

    if (node && navNode) {
      const rect = node.getBoundingClientRect();
      const navRect = navNode.getBoundingClientRect();

      setIndicator({
        left: rect.left - navRect.left + navNode.scrollLeft,
        width: rect.width,
        opacity: 1,
      });
    } else {
      setIndicator(prev => ({ ...prev, opacity: 0 }));
    }
  }, [currentTab]);

  useEffect(() => {
    // Small timeout to ensure layout is ready
    const timer = setTimeout(updateIndicator, 50);
    return () => clearTimeout(timer);
  }, [updateIndicator]);

  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  return (
    <>
      {/* ================= DESKTOP NAV ================= */}
      <header className="sticky flex top-5 z-50 hidden lg:flex w-full justify-center px-4">
        <div className="w-[95%] max-w-screen-2xl rounded-full border-2 border-neutral-800 px-6 py-2 bg-neutral-900 h-auto mx-auto flex gap-6 items-center">
          {/* Logo */}
          <Link to="/" className="flex h-[40px] items-center shrink-0">
            <img
              src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin"
              alt="logo"
              className="h-[100px] w-auto object-contain"
            />
          </Link>

          {/* Nav Tabs */}
          <div
            ref={navRef}
            className="relative flex items-center gap-3 flex-1 overflow-x-auto no-scrollbar"
          >
            {/* Sliding Line */}
            <motion.div
              className="absolute bottom-0 h-[2px] bg-[#D9FF00] rounded-full z-10"
              initial={false}
              animate={{
                left: indicator.left,
                width: indicator.width,
                opacity: indicator.opacity,
              }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 25,
                mass: 1,
              }}
            />

            {NAV_TABS.map(({ id, label, icon: Icon, path }) => {
              const isActive = activeTabId === id;
              const isExternal = path.startsWith('http');

              if (isExternal) {
                return (
                  <a
                    key={id}
                    href={path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative flex items-center gap-2 px-3 py-2 text-xs rounded-md text-neutral-400 hover:text-white transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </a>
                );
              }

              return (
                <Link
                  key={id}
                  to={path}
                  ref={(el) => {
                    tabRefs.current[id] = el;
                  }}
                  onMouseEnter={() => setHoveredTab(id)}
                  onMouseLeave={() => setHoveredTab(null)}
                  className={`relative flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-colors
                  ${isActive ? 'text-[#D9FF00]' : 'text-neutral-400 hover:text-white'}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* ================= MOBILE NAV ================= */}
      <header className="sticky top-3 z-50 px-3 flex justify-center lg:hidden">
        <div className="w-[80%] flex overflow-y-hidden h-[50px] items-center justify-between bg-neutral-900 border border-neutral-800 rounded-full px-4 py-2">
          {/* Logo */}
          <Link to="/">
            <img
              src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin"
              className="h-[80px]"
              alt="Logo"
            />
          </Link>

          {/* Menu Button */}
          <button onClick={() => setIsOpen(true)}>
            <Menu className="text-white" />
          </button>
        </div>
      </header>

      {/* ================= MOBILE DRAWER ================= */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              className="fixed inset-0 bg-black/50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              className="fixed top-0 right-0 h-full w-[80%] max-w-[300px] bg-neutral-900 z-50 p-5 flex flex-col gap-4 border-l border-neutral-800"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{
                type: 'spring',
                stiffness: 160,
                damping: 30,
              }}
            >
              {/* Close */}
              <div className="flex justify-end">
                <button onClick={() => setIsOpen(false)}>
                  <X />
                </button>
              </div>

              {/* Tabs */}
              {NAV_TABS.map(({ id, label, icon: Icon, path }) => {
                const isActive = activeTabId === id;
                const isExternal = path.startsWith('http');

                if (isExternal) {
                  return (
                    <a
                      key={id}
                      href={path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-3 rounded-md text-sm text-neutral-400"
                      onClick={() => setIsOpen(false)}
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                    </a>
                  );
                }

                return (
                  <Link
                    key={id}
                    to={path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm
                    ${isActive ? 'text-[#D9FF00] bg-neutral-800' : 'text-neutral-400'}`}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </Link>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
