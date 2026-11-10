import faceSvg from '../mascots/face.svg?raw';

export function BrandLogo({ as: Tag = 'div' }: { as?: 'div' | 'span' }) {
  return (
    <Tag
      className="brand-logo is-face is-mono"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: faceSvg }}
    />
  );
}
