import React from 'react';
import {MessageSquare, type LucideIcon} from 'lucide-react';
import type {AppTab, UserSettings} from '../../types';
import {triggerLightHaptic} from '../../utils/haptics';
import {GlassAvatar} from './LiquidGlass';

export interface NavDestination {
  id: AppTab;
  label: string;
  icon: LucideIcon;
}

interface GlassAppBarProps {
  navItems: NavDestination[];
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onOpenTutor: () => void;
  userSettings: UserSettings;
}

export const GlassAppBar: React.FC<GlassAppBarProps> = ({
  navItems,
  activeTab,
  onSelectTab,
  onOpenTutor,
  userSettings,
}) => {
  return (
    <header className="sticky top-0 z-30 pt-2 px-3 sm:px-6">
      <div className="max-w-5xl mx-auto lg-surface-strong rounded-[22px] h-14 px-3.5 sm:px-5 flex items-center justify-between gap-4">
        {/* Zone 1: Brand */}
        <button
          type="button"
          onClick={() => {
            void triggerLightHaptic();
            onSelectTab('tester');
          }}
          className="text-lg sm:text-xl font-extrabold tracking-tight whitespace-nowrap shrink-0 cursor-pointer lg-press"
          style={{color: 'var(--tx)'}}
        >
          french
          <span
            style={{
              background: 'linear-gradient(135deg, var(--main), var(--accent-violet))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            type
          </span>
        </button>

        {/* Zone 2: Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Navigation principale">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  void triggerLightHaptic();
                  onSelectTab(item.id);
                }}
                className="lg-press min-h-[40px] px-3.5 rounded-[14px] text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--main)' : 'var(--sub)',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Quick Actions (Tutor + Avatar to Settings) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              void triggerLightHaptic();
              onOpenTutor();
            }}
            aria-label="Ouvrir le tuteur IA"
            className="lg-press lg-surface-subtle min-h-[40px] px-3 rounded-[14px] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            style={{color: 'var(--main)'}}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Tuteur IA</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void triggerLightHaptic();
              onSelectTab('reglages');
            }}
            aria-label="Ouvrir les réglages du profil"
            className="lg-press min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full cursor-pointer"
          >
            <GlassAvatar
              name={userSettings.displayName}
              gradientId={userSettings.avatarGradientId}
              size="sm"
            />
          </button>
        </div>
      </div>
    </header>
  );
};

interface GlassBottomNavProps {
  navItems: NavDestination[];
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

export const GlassBottomNav: React.FC<GlassBottomNavProps> = ({
  navItems,
  activeTab,
  onSelectTab,
}) => {
  return (
    <nav
      aria-label="Navigation mobile"
      className="md:hidden fixed bottom-2 left-3 right-3 z-40 pb-safe pointer-events-none"
    >
      <div className="max-w-md mx-auto lg-dock rounded-[26px] p-1.5 grid grid-cols-5 items-center pointer-events-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                onSelectTab(item.id);
              }}
              className="lg-press min-h-[48px] rounded-[20px] flex flex-col items-center justify-center gap-0.5 cursor-pointer px-1"
              style={{
                backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--main)' : 'var(--sub)',
              }}
            >
              <Icon className="w-[19px] h-[19px]" strokeWidth={active ? 2.4 : 1.9} />
              <span className="text-[10px] font-semibold tracking-tight leading-none truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
