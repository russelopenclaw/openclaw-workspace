import React from 'react';
import {Composition, useCurrentFrame, useVideoConfig, AbsoluteFill, Audio} from 'remotion';
import {BackgroundImage} from './BackgroundImage';
import {SetupText} from './SetupText';
import {PunchlineText} from './PunchlineText';
import {SegmentText} from './SegmentText';
import {BRAND} from './brand';

/**
 * Enhanced DadJokeVideo with multi-segment support
 * 
 * Props:
 * - joke: Original joke text
 * - format: "one-liner" | "setup-punchline" | "multi-line"
 * - segments: Array of {text, atPercent, display}
 * - audioUrl: Path to audio file
 * - imageUrl: Path to background image
 */
interface DadJokeVideoProps {
  joke: string;
  format: 'one-liner' | 'setup-punchline' | 'multi-line';
  segments: Array<{
    text: string;
    atPercent: number;
    display: 'fade-in' | 'pop-in';
  }>;
  audioUrl?: string;
  imageUrl?: string;
  // Audio already has silence padded at start/end, so no buffer offset needed
}

export const DadJokeVideo: React.FC<DadJokeVideoProps> = ({
  joke,
  format,
  segments,
  audioUrl = 'audio.mp3',
  imageUrl = 'background.png',
}) => {
  const {fps, durationInFrames} = useVideoConfig();
  
  // Convert relative paths to webpack bundles if needed
  const effectiveAudioUrl = audioUrl.startsWith('/') || audioUrl.startsWith('http') 
    ? audioUrl 
    : require(`../public/${audioUrl}`);
  const effectiveImageUrl = imageUrl.startsWith('/') || imageUrl.startsWith('http') 
    ? imageUrl 
    : require(`../public/${imageUrl}`);
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.colors.navy,
      }}
    >
      {/* Background image with subtle zoom */}
      <BackgroundImage imageUrl={effectiveImageUrl} />
      
      {/* Dark overlay for text readability */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(16, 42, 84, 0.4)',
        }}
      />
      
      {/* Audio track - already has silence padded */}
      <Audio src={effectiveAudioUrl} />
      
      {/* Render segments based on format - timing relative to full video */}
      {segments.map((segment, index) => {
        const frameAt = Math.floor(segment.atPercent * durationInFrames);
        const isLast = index === segments.length - 1;
        
        // Setup disappears when punchline appears
        // Punchline stays until end
        const endFrame = isLast 
          ? undefined  // Last segment stays until end
          : frameAt + Math.floor(durationInFrames * 0.35); // Previous segment shows for ~35% of video
        
        return (
          <SegmentText
            key={index}
            text={segment.text}
            startFrame={frameAt}
            endFrame={endFrame}
            displayStyle={segment.display}
            position={index === 0 ? 'setup' : 'punchline'}
          />
        );
      })}
      
      {/* Branding watermark */}
      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: BRAND.fonts.setup,
          fontSize: '20px',
          color: BRAND.colors.text,
          opacity: 0.7,
          textShadow: '0px 2px 4px rgba(0,0,0,0.5)',
        }}
      >
        DadtasticDads
      </div>
    </AbsoluteFill>
  );
};

// Export compositions for Remotion
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DadJokeVideo"
        component={DadJokeVideo}
        durationInFrames={218} // 7.25s at 30fps (audio with 1s buffers)
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          joke: "A dad joke",
          format: "one-liner" as const,
          segments: [
            { text: "Loading joke...", atPercent: 0.0, display: "fade-in" }
          ],
          audioUrl: 'audio.mp3',
          imageUrl: 'background.png',
        }}
      />
    </>
  );
};
