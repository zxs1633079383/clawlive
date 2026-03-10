'use client';

interface LobsterAvatarProps {
  skillName: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const LOBSTER_COLORS: Record<string, string> = {
  'meeting-analyst': '#3B82F6',    // blue
  'devils-advocate': '#EF4444',    // red
  'note-taker': '#10B981',         // green
  'action-tracker': '#F59E0B',     // amber
};

const LOBSTER_ICONS: Record<string, string> = {
  'meeting-analyst': '\uD83D\uDD0D',
  'devils-advocate': '\uD83D\uDE08',
  'note-taker': '\uD83D\uDCDD',
  'action-tracker': '\u2705',
};

export function getLobsterColor(skillName: string): string {
  return LOBSTER_COLORS[skillName] ?? '#ff6b35';
}

export function getLobsterIcon(skillName: string): string {
  return LOBSTER_ICONS[skillName] ?? '\uD83E\uDD9E';
}

const SIZE_CLASSES: Record<string, string> = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

export function LobsterAvatar({ skillName, size = 'md', showLabel = false }: LobsterAvatarProps) {
  const color = getLobsterColor(skillName);
  const icon = getLobsterIcon(skillName);

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`${SIZE_CLASSES[size]} rounded-full flex items-center justify-center`}
        style={{ backgroundColor: `${color}20`, border: `2px solid ${color}` }}
      >
        {icon}
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-text-secondary" style={{ color }}>
          {skillName}
        </span>
      )}
    </div>
  );
}
