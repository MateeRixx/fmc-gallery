const fs = require('fs');
let code = fs.readFileSync('src/components/Lightbox.tsx', 'utf8');

code = code.replace(/<button\n\s*onClick=\{\(e\) => \{ e\.stopPropagation\(\); onNavigate\(\(currentIndex \+ 1\) \% images\.length\); \}\}\n\s*className="absolute right-2 sm:right-6 z-50 p-2 sm:p-3 text-white\/70 hover:text-white rounded-full bg-white\/10 hover:bg-white\/20 transition"\n\s*>\n\s*<svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n\s*\)\}/, 
`<button
  onClick={(e) => { e.stopPropagation(); onNavigate((currentIndex + 1) % images.length); }}
  className="absolute right-2 sm:right-6 z-50 p-2 sm:p-3 text-white/70 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition"
>
  <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
</button>
</>
)}`);

fs.writeFileSync('src/components/Lightbox.tsx', code);
