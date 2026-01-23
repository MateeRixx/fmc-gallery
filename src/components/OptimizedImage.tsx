import Image, { ImageProps } from 'next/image';

interface OptimizedImageProps extends Omit<ImageProps, 'quality'> {
  quality?: number;
  priority?: boolean;
}

/**
 * Optimized image component with sensible defaults
 * - Quality set to 75-80 to balance performance and visual quality
 * - Responsive sizes for mobile-first design
 * - Proper alt text handling
 */
export default function OptimizedImage({ 
  quality = 75, 
  priority = false,
  sizes,
  ...props 
}: OptimizedImageProps) {
  // Default responsive sizes if not provided
  const defaultSizes = 
    props.fill ? 
      '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw' : 
      undefined;

  return (
    <Image
      {...props}
      quality={quality}
      priority={priority}
      sizes={sizes || defaultSizes}
    />
  );
}
