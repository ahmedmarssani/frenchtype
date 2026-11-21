import React from 'react';
import {WifiOff} from 'lucide-react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-5 left-4 z-40 lg-surface-strong flex items-center gap-2 rounded-[16px] px-3.5 py-2.5 text-xs font-semibold"
      style={{
        borderColor: 'var(--border-strong)',
        color: 'var(--tx)',
      }}
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" style={{color: 'var(--main)'}} />
      <span>Mode hors-ligne · Dictionnaire & suivi actifs</span>
    </div>
  );
};
