// DadtasticDads Brand Configuration
// Extracted from banner image analysis

export const BRAND = {
  colors: {
    // Primary colors
    navy: '#102A54',
    navyLight: '#163A63',  // For pattern icons
    orange: '#FF8A2B',      // Main accent (sunset)
    orangeDark: '#D95A1A',  // Sunset edge/shadows
    
    // Secondary colors
    text: '#F8EFE1',        // Off-white text
    white: '#FFFFFF',       // Pure white strokes
    green: '#2E8B45',       // Trees
    brown: '#7A4B2E',       // Hair/beard/wood
    skin: '#F3C6A1',        // Skin tone
    gray: '#9AA3A6',        // Sweater
    flameYellow: '#FFD15A', // Flame inner
    flameOrange: '#F96F2B', // Flame outer
    mugOrange: '#C75A2A',   // Mug accent
  },
  
  fonts: {
    // System fonts as fallback
    setup: 'Verdana, Geneva, sans-serif',   // Clean, readable
    punchline: 'Verdana, Geneva, sans-serif', // Bold for punchline
  },
  
  // Text positioning for 480x720 canvas
  positioning: {
    setup: {
      y: '30%',
      x: '50%',
      maxWidth: '90%',
    },
    punchline: {
      y: '50%',
      x: '50%',
      maxWidth: '90%',
    },
  },
  
  // Animation styles
  animations: {
    setupEntry: 'fadeInUp',
    punchlineEntry: 'zoomIn',
    exit: 'fadeOut',
  },
  
  // Video timing defaults
  timing: {
    preJokeDelay: 30,
    postJokeSilence: 30,
    textFadeDuration: 10,
  },
  
  // Font sizes for 480x720 - LARGE and READABLE
  fontSizes: {
    setup: '56px',
    punchline: '64px',
  },
  
  // Text timing - how long each segment displays
  segmentDisplayDuration: 0.7, // 70% of video per segment
};

export type BrandConfig = typeof BRAND;
