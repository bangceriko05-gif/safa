import { Card, CardContent } from "@/components/ui/card";

export interface GalleryItem {
  title: string;
  description: string;
  image_url: string;
}

interface GallerySectionProps {
  tagline: string;
  title: string;
  description: string;
  items: GalleryItem[];
}

export default function GallerySection({ tagline, title, description, items }: GallerySectionProps) {
  if (items.length === 0) return null;

  return (
    <section id="gallery" className="py-16 md:py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-primary font-semibold mb-2">{tagline}</p>
          <h3 className="text-3xl md:text-4xl font-bold text-foreground">{title}</h3>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">{description}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, idx) => (
            <Card key={idx} className="border-0 shadow-md hover:shadow-lg transition-shadow bg-card overflow-hidden group">
              <div className="aspect-video overflow-hidden bg-muted">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <CardContent className="p-5 space-y-2">
                <h4 className="text-lg font-semibold text-foreground">{item.title}</h4>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
