"use client";

interface InfoCardProps {
  icon: string;
  title: string;
  description: string;
  variant?: "default" | "highlight";
}

export default function InfoCard({
  icon,
  title,
  description,
  variant = "default",
}: InfoCardProps) {
  const variants = {
    default:
      "bg-white/5 border-white/10 text-white",
    highlight:
      "bg-blue-500/20 border-blue-500/30 text-blue-100",
  };

  return (
    <div
      className={`rounded-xl p-4 border ${variants[variant]}`}
    >
      <div className="flex items-start space-x-3">
        <span className={`text-2xl ${icon ? "" : "hidden"}`}>
          {icon}
        </span>
        <div>
          <h3 className="font-semibold text-sm">
            {title}
          </h3>
          <p className="text-xs mt-1 opacity-80">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
