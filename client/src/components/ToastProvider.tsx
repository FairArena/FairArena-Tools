import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Toast = { id: string; message: string };

const ToastContext = createContext<{ show: (message: string) => void } | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string) => {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 7);
    setToasts((s) => [...s, { id, message }]);
    // auto-dismiss
    setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), 2200);
  }, []);

  useEffect(() => {
    // keep at most 4
    if (toasts.length > 4) setToasts((s) => s.slice(-4));
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}

      <div className="fixed right-4 bottom-6 z-50 flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto bg-neutral-900 text-white px-4 py-2 rounded-md shadow-lg border border-neutral-800 w-max max-w-xs"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
