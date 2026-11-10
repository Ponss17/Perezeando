import monoSvg from '../mascots/mono.svg?raw';

export function MascotMono({ className = '', size = 112 }: { className?: string; size?: number }) {
  return (
    <span
      className={className}
      style={{ width: size, height: size, display: 'block' }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: monoSvg }}
    />
  );
}
