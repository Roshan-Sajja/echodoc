interface AudioVisualizerProps {
  isActive: boolean;
  isDarkMode?: boolean;
}

export function AudioVisualizer({ isActive, isDarkMode }: AudioVisualizerProps) {
  const bg = isDarkMode
    ? 'bg-neutral-800/70 border border-neutral-700'
    : 'bg-slate-100 border border-slate-200';
  const dotColor = isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(51,65,85,0.45)';
  const barColor = isDarkMode ? 'bg-neutral-200' : 'bg-slate-600';

  return (
    <div
      className={`relative w-full h-10 rounded-full overflow-hidden flex items-center px-4 ${bg}`}
      aria-hidden="true"
      style={{
        backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent 6px, ${dotColor} 6px, ${dotColor} 10px)`,
        backgroundSize: '12px 2px',
        backgroundPosition: '0 55%',
        backgroundRepeat: 'repeat-x',
      }}
    >
      <div className="flex-1 flex justify-center items-end gap-[3px] h-full">
        {[...Array(14).keys()].map((i) => (
          <span
            key={i}
            className={`w-[3px] rounded-sm ${barColor} ${
              isActive ? 'opacity-100' : 'opacity-50'
            }`}
            style={{
              height: isActive ? `${5 + (i % 1) * 4}px` : '2px',
              animationName: isActive ? 'pulse' : 'none',
              animationDuration: isActive ? '1.1s' : undefined,
              animationTimingFunction: isActive ? 'ease-in-out' : undefined,
              animationIterationCount: isActive ? 'infinite' : undefined,
              animationDelay: isActive ? `${i * 0.07}s` : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
