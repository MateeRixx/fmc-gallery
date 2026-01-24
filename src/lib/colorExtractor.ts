/**
 * Extract dominant color from an image using Canvas API
 * @param imageUrl - URL of the image to extract color from
 * @returns RGB color array [r, g, b] or null if extraction fails
 */
export async function extractDominantColor(imageUrl: string): Promise<[number, number, number] | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(null);
          return;
        }
        
        ctx.drawImage(img, 0, 0, 100, 100);
        const imageData = ctx.getImageData(0, 0, 100, 100);
        const data = imageData.data;
        
        let r = 0, g = 0, b = 0;
        const pixelCount = data.length / 4;
        
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        
        r = Math.floor(r / pixelCount);
        g = Math.floor(g / pixelCount);
        b = Math.floor(b / pixelCount);
        
        resolve([r, g, b]);
      } catch (err) {
        console.error('Color extraction failed:', err);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      resolve(null);
    };
    
    img.src = imageUrl;
  });
}

/**
 * Convert RGB to rgba string with opacity
 * @param rgb - RGB color array [r, g, b]
 * @param opacity - Opacity value 0-1
 * @returns rgba string
 */
export function rgbToRgba(rgb: [number, number, number] | null, opacity: number = 0.65): string {
  if (!rgb) return 'rgba(255,191,0,0.65)'; // fallback golden
  const [r, g, b] = rgb;
  return `rgba(${r},${g},${b},${opacity})`;
}

/**
 * Brighten an RGB color for better glow effect
 * @param rgb - RGB color array [r, g, b]
 * @param factor - Brightness factor (1 = no change, > 1 = brighter)
 * @returns Brightened RGB array
 */
export function brightenColor(rgb: [number, number, number], factor: number = 1.2): [number, number, number] {
  return [
    Math.min(255, Math.floor(rgb[0] * factor)),
    Math.min(255, Math.floor(rgb[1] * factor)),
    Math.min(255, Math.floor(rgb[2] * factor)),
  ];
}
