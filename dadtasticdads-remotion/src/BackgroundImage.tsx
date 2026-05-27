import React from 'react';
import {useCurrentFrame, interpolate, useVideoConfig} from 'remotion';
import {BRAND} from './brand';

interface Props {
  imageUrl: string | any;
}

export const BackgroundImage: React.FC<Props> = ({imageUrl}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  
  // Subtle zoom effect over time
  const scale = interpolate(frame, [0, 300], [1, 1.05], {
    extrapolateRight: 'clamp',
  });
  
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transform: `scale(${scale})`,
      }}
    />
  );
};
