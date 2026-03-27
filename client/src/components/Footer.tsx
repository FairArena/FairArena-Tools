import {
  Github,
  Instagram,
  Linkedin,
  MapPin,
  MessageCircle,
  Twitter,
  Terminal,
  Globe,
  Code2,
  Network,
  Binary,
  Webhook,
  Link2,
  Mail,
  BookOpen,
  Gauge,
} from 'lucide-react';

interface FooterProps {
  onTabChange?: (tab: any) => void;
}

function Footer({ onTabChange }: FooterProps) {
  const isDark = true;

  const configuredFrontendUrl = (import.meta.env.VITE_FRONTEND_URL || '').replace(/\/$/, '');
  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : '';
  const isOfficialDomain = !configuredFrontendUrl || currentOrigin === configuredFrontendUrl;

  return (
    <footer
      className={`
        w-full pt-16 pb-8 px-6 mt-20 md:px-12 lg:px-20 border-t
        ${
          isDark
            ? 'bg-[#0f0f0f] border-white/10 text-neutral-400'
            : 'bg-[#f2f2f2] border-black/10 text-neutral-700'
        }
      `}
    >
      {/* Top Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
        {/* Brand + Social */}
        <div className="flex flex-col gap-6">
          <div className="relative -ml-4">
            <img
              src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin"
              className="h-24 w-auto object-contain"
              alt="FairArena Logo"
            />
          </div>

          <p className="text-sm max-w-xs leading-relaxed">
            The ultimate developer toolkit for testing APIs, managing webhooks, and debugging
            network requests in a unified workspace.
          </p>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/FairArena"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              title="GitHub"
              className={`p-2 rounded-full transition-all duration-200 hover:scale-110 ${isDark ? 'bg-neutral-900 border border-neutral-800 text-[#DDFF00]' : 'bg-neutral-200 text-[#556000]'}`}
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="https://www.linkedin.com/company/fairarena"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              title="LinkedIn"
              className={`p-2 rounded-full transition-all duration-200 hover:scale-110 ${isDark ? 'bg-neutral-900 border border-neutral-800 text-[#DDFF00]' : 'bg-neutral-200 text-[#556000]'}`}
            >
              <Linkedin className="w-5 h-5" />
            </a>
            <a
              href="https://www.instagram.com/fair.arena"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              title="Instagram"
              className={`p-2 rounded-full transition-all duration-200 hover:scale-110 ${isDark ? 'bg-neutral-900 border border-neutral-800 text-[#DDFF00]' : 'bg-neutral-200 text-[#556000]'}`}
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://x.com/real_fairarena"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter"
              title="Twitter"
              className={`p-2 rounded-full transition-all duration-200 hover:scale-110 ${isDark ? 'bg-neutral-900 border border-neutral-800 text-[#DDFF00]' : 'bg-neutral-200 text-[#556000]'}`}
            >
              <Twitter className="w-5 h-5" />
            </a>
          </div>

          <div className="mt-2">
            <a
              href="https://www.trustpilot.com/review/fairarena.app"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Read our reviews on Trustpilot"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isDark
                  ? 'bg-emerald-900/30 border border-emerald-800/50 text-emerald-400 hover:bg-emerald-800/30 focus:ring-emerald-500'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-400'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-4 h-4 shrink-0"
                aria-hidden
                focusable="false"
              >
                <path
                  fill="currentColor"
                  d="M12 17.27L18.18 21 16.54 13.97 22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                />
              </svg>
              <span>Review us on Trustpilot</span>
            </a>
          </div>
        </div>

        {/* Tools Section 1 */}
        <div className="md:ml-auto">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
            Developer Tools
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              { id: 'terminal', label: 'Interactive Terminal', icon: Terminal },
              { id: 'api', label: 'API Tester', icon: Globe },
              { id: 'webhook', label: 'Webhook Dumper', icon: Webhook },
              { id: 'network', label: 'Network Inspector', icon: Network },
              { id: 'rate-limit', label: 'Rate Limit Tester', icon: Gauge },
            ].map((item) => (
              <li
                key={item.id}
                onClick={() => onTabChange?.(item.id)}
                className={`
                    cursor-pointer flex items-center gap-2 transition-colors
                    ${isDark ? 'hover:text-[#DDFF00]' : 'hover:text-[#556000]'}
                  `}
              >
                <item.icon className="w-4 h-4 opacity-70" />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Tools Section 2 */}
        <div className="md:ml-auto">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
            Utilities
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              { id: 'dev-tools', label: 'Dev Utilities', icon: Code2 },
              { id: 'encoders', label: 'Encoders & Decoders', icon: Binary },
              { id: 'clipsync', label: 'ClipSync Sharing', icon: Link2 },
              { id: 'tempmail', label: 'TempMail Service', icon: Mail },
              { id: 'guide', label: 'Getting Started', icon: BookOpen },
            ].map((item) => (
              <li
                key={item.id}
                onClick={() => {
                  if (item.id === 'tempmail') {
                    window.open('https://tempmail.fairarena.app', '_blank');
                    return;
                  }
                  onTabChange?.(item.id);
                }}
                className={`
                  cursor-pointer flex items-center gap-2 transition-colors
                  ${isDark ? 'hover:text-[#DDFF00]' : 'hover:text-[#556000]'}
                `}
              >
                <item.icon className="w-4 h-4 opacity-70" />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact & Support */}
        <div className="md:ml-auto">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
            Connect
          </h3>
          <ul className="mt-4 space-y-4 text-sm">
            <li className="flex gap-3">
              <MessageCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#DDFF00]" />
              <div className="flex flex-col">
                <a
                  href="mailto:support@fairarena.app"
                  className={`font-medium cursor-pointer transition-colors ${isDark ? 'hover:text-[#DDFF00]' : 'hover:text-[#556000]'}`}
                >
                  Contact Support
                </a>
                <span className="text-xs text-neutral-500 mt-1">24/7 Developer Support</span>
              </div>
            </li>
            <li className="flex gap-3">
              <Github className="w-5 h-5 shrink-0 mt-0.5 text-[#DDFF00]" />
              <div className="flex flex-col">
                <a
                  href="https://github.com/FairArena"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`font-medium cursor-pointer transition-colors ${isDark ? 'hover:text-[#DDFF00]' : 'hover:text-[#556000]'}`}
                >
                  Open Source
                </a>
                <span className="text-xs text-neutral-500 mt-1">Contribute on GitHub</span>
              </div>
            </li>
            <li className="flex gap-3">
              <MapPin className="w-5 h-5 shrink-0 mt-0.5 text-[#DDFF00]" />
              <span className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>
                Cloud Native Tools
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Divider */}
      <div
        className={`mt-16 border-t ${isDark ? 'border-neutral-800' : 'border-neutral-300'}`}
      ></div>

      {/* Bottom Section */}
      <div className="flex flex-col md:flex-row justify-between items-center mt-8 text-sm gap-6 md:gap-0">
        <div className="flex flex-col items-center md:items-start gap-1">
          <p className={`${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
            © {new Date().getFullYear()} FairArena. All rights reserved.
          </p>
          <p className="text-xs text-neutral-600">
            Empowering developers with lightning-fast tools.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
          {[
            { label: 'Privacy Policy', path: '#' },
            { label: 'Terms of Service', path: '#' },
            { label: 'Cookie Policy', path: '#' },
            { label: 'Refund Policy', path: '#' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.path}
              className={`
                cursor-pointer transition-colors text-xs font-medium
                ${isDark ? 'text-neutral-500 hover:text-[#DDFF00]' : 'text-neutral-600 hover:text-[#556000]'}
              `}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex flex-col items-center md:items-end gap-1">
          <p className={`${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
            Built with ❤️ for Developers
          </p>
          {!isOfficialDomain && (
            <p className="text-xs flex gap-1">
              <span className="text-neutral-600">Powered by</span>
              <a
                href={configuredFrontendUrl || 'https://fairarena.app'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#DDFF00] hover:underline font-bold"
              >
                FairArena
              </a>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
