import React from 'react';
import { Home, Zap } from 'lucide-react';
import { Button } from './ui/button';

export const NotFound: React.FC = () => {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-900">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-indigo-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-violet-600/4 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative max-w-md w-full mx-auto px-4 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
        </div>

        {/* 404 Code */}
        <div className="mb-6">
          <h1 className="text-7xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            404
          </h1>
          <p className="text-slate-400 text-sm mt-2">Page Not Found</p>
        </div>

        {/* Description */}
        <h2 className="text-2xl font-bold text-white mb-3">Oops! We Can't Find That</h2>
        <p className="text-slate-400 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or may have been moved. Don't worry, you can
          always get back to testing.
        </p>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { icon: '🚀', label: 'Terminal', path: '#terminal' },
            { icon: '🌐', label: 'API Tester', path: '#api' },
            { icon: '📦', label: 'Mock Server', path: '#mock-server' },
            { icon: '✓', label: 'Schema', path: '#schema' },
          ].map(({ icon, label, path }) => (
            <button
              key={path}
              onClick={() => (window.location.hash = path)}
              className="p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600/50 transition-all text-xs font-medium text-slate-300 hover:text-white"
            >
              <div className="text-lg mb-1">{icon}</div>
              {label}
            </button>
          ))}
        </div>

        {/* Main Action */}
        <Button
          onClick={() => {
            window.location.hash = '';
          }}
          className="w-full gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white mb-3"
        >
          <Home className="w-4 h-4" />
          Back to Terminal
        </Button>

        {/* Secondary Action */}
        <button
          onClick={() => window.location.reload()}
          className="w-full p-2.5 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white transition-colors text-sm font-medium"
        >
          Refresh Page
        </button>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-xs text-slate-500">
            Lost? Check the <span className="text-slate-400">Guide</span> tab for help.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
