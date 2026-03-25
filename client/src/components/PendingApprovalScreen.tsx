import React from 'react';
import { Clock, AlertCircle } from 'lucide-react';

interface PendingApprovalScreenProps {
  roomId: string;
  errorMsg?: string;
  onLeave?: () => void;
}

export const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({
  roomId,
  errorMsg,
  onLeave,
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center">
      {/* Animated spinner */}
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/30 animate-pulse">
          <Clock className="w-10 h-10 text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
      </div>

      {/* Main message */}
      <h2 className="text-2xl font-bold text-white mb-2">Awaiting Approval</h2>

      {/* Room code display */}
      <div className="mb-6">
        <p className="text-sm text-slate-400 mb-2">Waiting for room owner to approve your join request...</p>
        <div className="inline-block bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500 tracking-widest mb-1">ROOM CODE</p>
          <p className="text-2xl font-mono font-bold text-emerald-400 tracking-wider">{roomId.toUpperCase()}</p>
        </div>
      </div>

      {/* Error or info message */}
      {errorMsg ? (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6 max-w-xs">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-left">
            <p className="text-sm text-amber-300 font-medium">Status</p>
            <p className="text-xs text-amber-100/80">{errorMsg}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6 max-w-xs">
          <div className="text-left">
            <p className="text-sm text-blue-300 font-medium">What's happening?</p>
            <ul className="text-xs text-blue-100/80 space-y-1 mt-2 list-disc list-inside">
              <li>Your join request has been sent to the room owner</li>
              <li>The owner must approve your request to join</li>
              <li>Once approved, you'll automatically enter the room</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="mt-8 text-xs text-slate-500 space-y-2 max-w-sm">
        <p>💡 <strong>Tip:</strong> If the owner is offline, your request will be automatically accepted.</p>
        <p>⏱️ <strong>Timeout:</strong> If you don't hear back in 5 minutes, try joining again with a new code.</p>
      </div>

      {onLeave && (
        <button
          onClick={onLeave}
          className="mt-6 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          Leave waiting room
        </button>
      )}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
};
