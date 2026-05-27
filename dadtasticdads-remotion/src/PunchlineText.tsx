import React, {useEffect} from 'react';
import {useCurrentFrame, interpolate, useVideoConfig, continueRender, delayRender} from 'remotion';
import {BRAND} from './brand';

interface Props {
  text: string;
  startFrame: number;
  opacity?: number;
}

export const PunchlineText: React.FC<Props> = ({text, startFrame, opacity = 1}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  
  const [handle] = React.useState(() => delayRender());
  
  useEffect(() => {
    continueRender(handle);
  }, [handle]);
  
  // Punchline pops in with emphasis
  const scale = interpolate(
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
  
  const textOpacity = interpolate(
    frame,
    [startFrame, startFrame + BRAND.timing.textFadeDuration],
    [0, opacity],
    {extrapolateRight: 'clamp'}
  );
  
  if (frame < startFrame) {
    return null;
  }
  
  return (
    <div
      style={{
        position: 'absolute',
        top: BRAND.positioning.punchline.y,
        left: BRAND.positioning.punchline.x,
        transform: `translate(-50%, -50%) scale(${scale * bounceScale})`,
        textAlign: 'center',
        fontFamily: BRAND.fonts.punchline,
        fontSize: '64px',
        fontWeight: 'bold',
        color: BRAND.colors.orange,
        textShadow: `
          -3px -3px 0 ${BRAND.colors.white},
          3px -3px 0 ${BRAND.colors.white},
          -3px 3px 0 ${BRAND.colors.white},
          3px 3px 0 ${BRAND.colors.white},
          0px 4px 12px rgba(0,0,0,0.6)
        `,
        opacity: textOpacity,
        maxWidth: BRAND.positioning.punchline.maxWidth,
        lineHeight: 1.2,
      }}
    >
      {text}
    </div>
  );
};
