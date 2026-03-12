export interface PartnerLogo {
  name: string;
  logo_url: string;
  logo_size?: number;
}

interface PartnersSectionProps {
  tagline: string;
  title: string;
  logos: PartnerLogo[];
}

export default function PartnersSection({ tagline, title, logos }: PartnersSectionProps) {
  if (logos.length === 0) return null;

  return (
    <section className="py-16 md:py-20 border-y bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-primary font-semibold mb-2">{tagline}</p>
          <h3 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h3>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {logos.map((partner, idx) => (
            <div key={idx} className="flex items-center justify-center transition-all duration-300">
              <img
                src={partner.logo_url}
                alt={partner.name}
                style={{ height: `${partner.logo_size || 56}px` }}
                className="w-auto object-contain"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
