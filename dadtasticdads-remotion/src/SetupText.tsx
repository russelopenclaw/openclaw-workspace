import React, {useEffect} from 'react';
import {useCurrentFrame, interpolate, useVideoConfig, continueRender, delayRender} from 'remotion';
import {BRAND} from './brand';

interface Props {
  text: string;
  startFrame: number;
  endFrame?: number; // Frame to start fading out (optional)
  opacity?: number;
}

export const SetupText: React.FC<Props> = ({text, startFrame, endFrame, opacity = 1}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  
  // Track render handle for font loading
  const [handle] = React.useState(() => delayRender());
  
  useEffect(() => {
    continueRender(handle);
  }, [handle]);
  
  // Fade in animation
  const fadeInOpacity = interpolate(
    frame,
    [startFrame, startFrame + BRAND.timing.textFadeDuration],
    [0, opacity],
    {extrapolateRight: 'clamp'}
  );
  
  // Fade out animation (if endFrame specified)
  let textOpacity = fadeInOpacity;
  if (endFrame) {
    const fadeOutOpacity = interpolate(
      frame,
      [endFrame, endFrame + BRAND.timing.textFadeDuration],
      [opacity, 0],
      {extrapolateRight: 'clamp'}
    );
    textOpacity = Math.min(fadeInOpacity, fadeOutOpacity);
  }
  
  // Slide up animation
  const translateY = interpolate(
    frame,
    [startFrame, startFrame + BRAND.timing.textFadeDuration],
    [50, 0],
    {extrapolateRight: 'clamp'}
  );
  
  // Scale emphasis
  const scale = interpolate(
    frame,
    [startFrame, startFrame + 15],
    [0.95, 1],
    {extrapolateRight: 'clamp'}
  );
  
  if (frame < startFrame) {
    return null;
  }
  
  // Fade out completely after endFrame + fadeDuration
  if (endFrame && frame > endFrame + BRAND.timing.textFadeDuration) {
    return null;
  }
  
  return (
    <div
      style={{
        position: 'absolute',
        top: BRAND.positioning.setup.y,
        left: BRAND.positioning.setup.x,
        transform: `translate(-50%, -50%) translateY(${translateY}px) scale(${scale})`,
        textAlign: 'center',
        fontFamily: BRAND.fonts.setup,
        fontSize: '56px',
        fontWeight: 'bold',
        color: BRAND.colors.text,
        textShadow: `
          -3px -3px 0 ${BRAND.colors.white},
          3px -3px 0 ${BRAND.colors.white},
          -3px 3px 0 ${BRAND.colors.white},
          3px 3px 0 ${BRAND.colors.white},
          0px 4px 8px rgba(0,0,0,0.5)
        `,
        opacity: textOpacity,
        maxWidth: BRAND.positioning.setup.maxWidth,
        lineHeight: 1.2,
      }}
    >
      {text}
    </div>
  );
};
