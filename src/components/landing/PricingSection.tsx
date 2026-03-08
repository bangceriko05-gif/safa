import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";

export interface PricingItem {
  name: string;
  price: string;
  period: string;
  features: string[];
  is_popular: boolean;
  btn_text: string;
}

interface PricingSectionProps {
  tagline: string;
  title: string;
  description: string;
  items: PricingItem[];
  onCta: () => void;
}

export default function PricingSection({ tagline, title, description, items, onCta }: PricingSectionProps) {
  if (items.length === 0) return null;

  return (
    <section id="harga" className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-primary font-semibold mb-2">{tagline}</p>
          <h3 className="text-3xl md:text-4xl font-bold text-foreground">{title}</h3>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">{description}</p>
        </div>
        <div className={`grid gap-6 max-w-5xl mx-auto ${items.length === 1 ? 'max-w-md' : items.length === 2 ? 'md:grid-cols-2 max-w-3xl' : 'md:grid-cols-3'}`}>
          {items.map((item, idx) => (
            <Card
              key={idx}
              className={`relative overflow-hidden transition-shadow ${
                item.is_popular
                  ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]"
                  : "border shadow-md hover:shadow-lg"
              }`}
            >
              {item.is_popular && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-bl-lg">
                  Populer
                </div>
              )}
              <CardContent className="p-6 space-y-6">
                <div>
                  <h4 className="text-xl font-bold text-foreground">{item.name}</h4>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-foreground">{item.price}</span>
                    {item.period && (
                      <span className="text-muted-foreground text-sm">/{item.period}</span>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {item.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full"
                  variant={item.is_popular ? "default" : "outline"}
                  onClick={onCta}
                >
                  {item.btn_text || "Mulai Sekarang"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
