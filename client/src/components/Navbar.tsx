import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
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
  | 'url-shortener';

interface NavbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const NAV_TABS: {
  id: TabId;
  label: string;
  icon: any;
}[] = [
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'api', label: 'API Tester', icon: Globe },
  { id: 'dev-tools', label: 'Dev Tools', icon: Code2 },
  { id: 'network', label: 'Network', icon: Network },
  { id: 'encoders', label: 'Encoders', icon: Binary },
  { id: 'rate-limit', label: 'Rate Limit', icon: Gauge },
  { id: 'webhook', label: 'Webhooks', icon: Webhook },
  { id: 'url-shortener', label: 'URL Shortener', icon: Link2 },
  { id: 'clipsync', label: 'ClipSync', icon: Link2 },
  { id: 'tempmail', label: 'TempMail', icon: Mail },
  { id: 'guide', label: 'Guide', icon: BookOpen },
];

export function Navbar({ activeTab, onTabChange }: NavbarProps) {
  const [hoveredTab, setHoveredTab] = useState<TabId | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const navRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>(
    {} as Record<TabId, HTMLButtonElement | null>,
  );

  const [indicator, setIndicator] = useState({
    left: 0,
    width: 0,
  });

  const currentTab = hoveredTab || activeTab;

  useEffect(() => {
    const node = tabRefs.current[currentTab];
    const navNode = navRef.current;

    if (node && navNode) {
      const rect = node.getBoundingClientRect();
      const navRect = navNode.getBoundingClientRect();

      setIndicator({
        left: rect.left - navRect.left,
        width: rect.width,
      });
    }
  }, [currentTab]);

  return (
    <>
      {/* ================= DESKTOP NAV (UNCHANGED) ================= */}
      <header className="sticky flex top-5 z-50 hidden lg:flex">
        <div className="max-w-screen-2xl rounded-full border-2 border-neutral-800 px-10 py-2 bg-neutral-900 h-auto mx-auto flex gap-10">
          {/* Logo */}
          <div className=" flex h-[50px] items-center shrink-0">
            <img
              src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin"
              alt="logo"
              className="h-[100px] w-auto object-contain"
            />
          </div>

          {/* Nav Tabs */}
          <div
            ref={navRef}
            className="relative flex items-center gap-3 flex-1 overflow-x-auto no-scrollbar"
          >
            {/* Sliding Line */}
            <motion.div
              className="absolute bottom-0 h-[2px] bg-[#D9FF00] rounded-full"
              animate={{
                left: indicator.left,
                width: indicator.width,
              }}
              transition={{
                type: 'spring',
                stiffness: 160, // slower
                damping: 35,
                mass: 1.2,
              }}
            />

            {NAV_TABS.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;

              return (
                <motion.button
                  key={id}
                  ref={(el) => {
                    tabRefs.current[id] = el;
                  }}
                  onMouseEnter={() => setHoveredTab(id)}
                  onMouseLeave={() => setHoveredTab(null)}
                  onClick={() => {
                    if (id === 'tempmail') {
                      window.open(
                        'https://tempmail.fairarena.app',
                        '_blank',
                        'noopener,noreferrer',
                      );
                      return;
                    }
                    onTabChange(id);
                  }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative flex items-center gap-2 px-3 py-2 text-xs rounded-md
                  ${isActive ? 'text-[#D9FF00]' : 'text-neutral-400 hover:text-white'}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ================= MOBILE NAV ================= */}
      <header className="sticky top-3 z-50 px-3 flex justify-center lg:hidden">
        <div className="w-[80%] flex overflow-y-hidden h-[50px] items-center justify-between bg-neutral-900 border border-neutral-800 rounded-full px-4 py-2">
          {/* Logo */}
          <img
            src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin"
            className="h-[80px]"
          />

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
              {NAV_TABS.map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id;

                return (
                  <button
                    key={id}
                    onClick={() => {
                      if (id === 'tempmail') {
                        window.open('https://tempmail.fairarena.app', '_blank');
                        return;
                      }
                      onTabChange(id);
                      setIsOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm
                    ${isActive ? 'text-[#D9FF00] bg-neutral-800' : 'text-neutral-400'}`}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
