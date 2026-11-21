import React, {useState} from 'react';
import {Download, Share} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';
import {GlassButton, GlassModal} from './ui/LiquidGlass';

export const PWAInstallButton: React.FC = () => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <GlassButton variant="primary" size="sm" onClick={install}>
        <Download className="w-4 h-4" />
        <span>Installer l’app</span>
      </GlassButton>
    );
  }

  if (isIOS) {
    return (
      <>
        <GlassButton variant="glass" size="sm" onClick={() => setShowIOSGuide(true)}>
          <Share className="w-4 h-4" style={{color: 'var(--main)'}} />
          <span>Installer sur iOS</span>
        </GlassButton>

        <GlassModal
          open={showIOSGuide}
          onClose={() => setShowIOSGuide(false)}
          title="Installer sur iPhone / iPad"
          icon={<Share className="w-5 h-5" />}
          maxWidthClass="sm:max-w-sm"
        >
          <div className="space-y-4">
            <ol className="space-y-3 text-sm leading-relaxed" style={{color: 'var(--tx)'}}>
              <li>1. Touchez le bouton <strong>Partager</strong> dans la barre Safari.</li>
              <li>2. Faites défiler et choisissez <strong>Sur l’écran d’accueil</strong>.</li>
              <li>3. Touchez <strong>Ajouter</strong> pour lancer frenchtype en plein écran hors-ligne.</li>
            </ol>
            <GlassButton
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => setShowIOSGuide(false)}
            >
              Compris
            </GlassButton>
          </div>
        </GlassModal>
      </>
    );
  }

  return null;
};
