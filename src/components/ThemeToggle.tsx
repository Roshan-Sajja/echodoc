/**
 * Tiny button component that switches between light/dark visuals. Keeps the
 * styling minimal so it can drop into headers without layout issues.
 */
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="w-9 h-9 p-0"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors" />
      ) : (
        <Moon className="w-5 h-5 text-slate-600 hover:text-slate-900 transition-colors" />
      )}
    </Button>
  );
}
