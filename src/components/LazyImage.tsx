import React, { useState } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  style?: React.CSSProperties;
}

// Helper to generate responsive image URLs
const getOptimizedUrls = (originalSrc: string | null | undefined) => {
  if (!originalSrc) return { src: '', srcSet: undefined };

  // Handle Cloudinary URLs
  if (originalSrc.includes('res.cloudinary.com')) {
    const parts = originalSrc.split('/upload/');
    if (parts.length === 2) {
      const base = parts[0] + '/upload';
      const path = parts[1];
      // q_auto, f_auto for automatic quality and format
      const src = `${base}/q_auto,f_auto/${path}`;
      const srcSet = `
        ${base}/w_400,c_fill,q_auto,f_auto/${path} 400w,
        ${base}/w_800,c_fill,q_auto,f_auto/${path} 800w,
        ${base}/w_1200,c_fill,q_auto,f_auto/${path} 1200w
      `;
      return { src, srcSet };
    }
  }

  // Handle Unsplash URLs
  if (originalSrc.includes('images.unsplash.com')) {
    const url = new URL(originalSrc);
    url.searchParams.set('auto', 'format');
    url.searchParams.set('fit', 'crop');
    url.searchParams.set('q', '80');
    
    const src = url.toString();
    
    url.searchParams.set('w', '400');
    const w400 = url.toString();
    
    url.searchParams.set('w', '800');
    const w800 = url.toString();
    
    url.searchParams.set('w', '1200');
    const w1200 = url.toString();

    return { src, srcSet: `${w400} 400w, ${w800} 800w, ${w1200} 1200w` };
  }

  return { src: originalSrc, srcSet: undefined };
};

export const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className = '', imgClassName = '', style, ...props }) => {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return (
      <div 
        className={`relative bg-slate-100 flex items-center justify-center ${className}`} 
        style={style}
      >
        {/* Render placeholder background only */}
      </div>
    );
  }

  const { src: optimizedSrc, srcSet } = getOptimizedUrls(src);

  if (!optimizedSrc) {
    return (
      <div 
        className={`relative bg-slate-100 flex items-center justify-center ${className}`} 
        style={style}
      >
        {/* Render placeholder background only */}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-slate-200 ${className}`}>
      <img
        src={optimizedSrc}
        srcSet={srcSet}
        sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
        style={style}
        {...props}
      />
    </div>
  );
};
