interface SectionHeaderProps {
  tagline: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  light?: boolean;
}

export default function SectionHeader({ tagline, title, description, align = 'left', light = false }: SectionHeaderProps) {
  return (
    <div className={`mb-8 sm:mb-12 ${align === 'center' ? 'text-center' : ''}`}>
      <p className={`tagline mb-2 ${light ? 'text-primary-300' : 'text-primary-500'}`}>
        {tagline}
      </p>
      <h2 className={`section-heading ${light ? 'text-white' : 'text-[#1A1919]'}`}>
        {title}
      </h2>
      {description && (
        <p className={`mt-3 max-w-2xl text-sm sm:text-base leading-relaxed ${align === 'center' ? 'mx-auto' : ''} ${light ? 'text-gray-400' : 'text-gray-600'}`}>
          {description}
        </p>
      )}
    </div>
  );
}
