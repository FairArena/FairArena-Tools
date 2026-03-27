import React from 'react';
import { Home, Zap, Terminal, Globe, Box, Check } from 'lucide-react';
import { Button } from './ui/button';

export const NotFound: React.FC = () => {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-neutral-950">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-brand-500/4 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative max-w-md w-full mx-auto px-4 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Zap className="w-8 h-8 text-neutral-900" strokeWidth={2.5} />
          </div>
        </div>

        {/* 404 Code */}
        <div className="mb-6">
          <h1 className="text-7xl font-bold text-brand-500">404</h1>
          <p className="text-neutral-400 text-sm mt-2">Page Not Found</p>
        </div>

        {/* Description */}
        <h2 className="text-2xl font-bold text-white mb-3">Oops! We Can't Find That</h2>
        <p className="text-neutral-400 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or may have been moved. Don't worry, you can
          always get back to testing.
        </p>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { icon: <Terminal className="w-5 h-5" />, label: 'Terminal', path: '#terminal' },
            { icon: <Globe className="w-5 h-5" />, label: 'API Tester', path: '#api' },
            { icon: <Box className="w-5 h-5" />, label: 'Mock Server', path: '#mock-server' },
            { icon: <Check className="w-5 h-5" />, label: 'Schema', path: '#schema' },
          ].map(({ icon, label, path }) => (
            <button
              key={path}
              onClick={() => (window.location.hash = path)}
              className="p-3 rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/50 hover:border-neutral-600/50 transition-all text-xs font-medium text-neutral-300 hover:text-white"
            >
              <div className="flex justify-center text-brand-500 mb-2">{icon}</div>
              {label}
            </button>
          ))}
        </div>

        {/* Main Action */}
        <Button
          onClick={() => {
            window.location.hash = '';
          }}
          className="w-full gap-2 bg-brand-500 hover:bg-brand-400 text-neutral-900 font-bold mb-3"
        >
          <Home className="w-4 h-4" />
          Back to Terminal
        </Button>

        {/* Secondary Action */}
        <button
          onClick={() => window.location.reload()}
          className="w-full p-2.5 rounded-lg border border-neutral-700 hover:border-neutral-600 text-neutral-300 hover:text-white transition-colors text-sm font-medium"
        >
          Refresh Page
        </button>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-neutral-800">
          <p className="text-xs text-neutral-500">
            Lost? Check the <span className="text-neutral-400">Guide</span> tab for help.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
