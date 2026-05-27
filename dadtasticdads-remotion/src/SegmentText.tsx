import React, {useEffect} from 'react';
import {useCurrentFrame, interpolate, useVideoConfig, continueRender, delayRender} from 'remotion';
import {BRAND} from './brand';

interface Props {
  text: string;
  startFrame: number;
  endFrame?: number; // Frame to start fading out (optional)
  displayStyle: 'fade-in' | 'pop-in';
  position: 'setup' | 'punchline';
}

export const SegmentText: React.FC<Props> = ({
  text,
  startFrame,
  endFrame,
  displayStyle,
  position,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  
  // Track render handle for font loading
  const [handle] = React.useState(() => delayRender());
  
  useEffect(() => {
    continueRender(handle);
  }, [handle]);
  
  // Position settings
  const posConfig = position === 'setup' 
    ? BRAND.positioning.setup 
    : BRAND.positioning.punchline;
  
  const fontSize = position === 'setup' 
    ? BRAND.fontSizes?.setup || '56px' 
    : BRAND.fontSizes?.punchline || '80px';
  const textColor = position === 'setup' ? '#FFFFFF' : '#FF8A2B';
  const fontWeight = '900';
  const fontFamily = 'Georgia, serif'; // Serif fonts have distinct I vs J
  
  // Animation based on display style
  let scale, translateY, textOpacity;
  
  if (displayStyle === 'fade-in') {
    // Smooth fade in with slide up
    textOpacity = interpolate(
      frame,
      [startFrame, startFrame + BRAND.timing.textFadeDuration],
      [0, 1],
      {extrapolateRight: 'clamp'}
    );
    
    translateY = interpolate(
      frame,
      [startFrame, startFrame + BRAND.timing.textFadeDuration],
      [50, 0],
      {extrapolateRight: 'clamp'}
    );
    
    scale = interpolate(
      frame,
      [startFrame, startFrame + 15],
      [0.95, 1],
      {extrapolateRight: 'clamp'}
    );
  } else { // pop-in
    // Punchline pop with bounce
    const popScale = interpolate(
      frame,
      [startFrame, startFrame + 10],
      [0.5, 1.1],
      {extrapolateRight: 'clamp'}
    );
    
    const bounceScale = interpolate(
      frame,
      [startFrame + 10, startFrame + 20],
      [1.1, 1],
      {extrapolateRight: 'clamp'}
    );
    
    scale = popScale * bounceScale;
    translateY = 0;
    
    textOpacity = interpolate(
      frame,
      [startFrame, startFrame + BRAND.timing.textFadeDuration],
      [0, 1],
      {extrapolateRight: 'clamp'}
    );
  }
  
  // Fade out if endFrame specified
  if (endFrame !== undefined) {
    const fadeOutOpacity = interpolate(
      frame,
      [endFrame, endFrame + BRAND.timing.textFadeDuration],
      [1, 0],
      {extrapolateRight: 'clamp'}
    );
    textOpacity = Math.min(textOpacity, fadeOutOpacity);
  }
  
  // Hide before start or after fade out
  if (frame < startFrame) {
    return null;
  }
  
  if (endFrame !== undefined && frame > endFrame + BRAND.timing.textFadeDuration) {
    return null;
  }
  
  return (
    <div
      style={{
        position: 'absolute',
        top: posConfig.y,
        left: posConfig.x,
        transform: `translate(-50%, -50%) translateY(${translateY}px) scale(${scale})`,
        textAlign: 'center',
        fontFamily: fontFamily,
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: textColor,
        textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
        opacity: textOpacity,
        maxWidth: posConfig.maxWidth,
        lineHeight: 1.2,
      }}
    >
       {text}
    </div>
  );
};
