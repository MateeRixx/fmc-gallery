"use client";

interface FeatureItem {
  text: string;
  icon?: string;
}

interface FeaturesListProps {
  features: FeatureItem[];
  title?: string;
  variant?: "default" | "highlight";
}

export default function FeaturesList({
  features,
  title,
  variant = "default",
}: FeaturesListProps) {
  const variants = {
    default:
      "bg-white/5 border-white/10 text-white",
    highlight:
      "bg-blue-500/20 border-blue-500/30 text-blue-100",
  };

  return (
    <div className={`rounded-xl p-4 border ${variants[variant]}`}>
      {title && (
        <h4 className="font-semibold text-sm mb-2">
          {title}
        </h4>
      )}
      <ul className="space-y-1 text-xs">
        {features.map((feature, idx) => (
          <li key={idx} className="opacity-80">
            {feature.icon && <span>{feature.icon} </span>}
            {feature.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
