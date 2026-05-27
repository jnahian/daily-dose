import React from "react";

interface TypewriterProps {
  text: string;
  /** 0..1 fill progress */
  progress: number;
  style?: React.CSSProperties;
}

export const Typewriter: React.FC<TypewriterProps> = ({ text, progress, style }) => {
  const visibleLength = Math.round(text.length * Math.min(1, Math.max(0, progress)));
  return (
    <span style={style}>
      {text.slice(0, visibleLength)}
      {visibleLength < text.length && (
        <span style={{ opacity: 0.6, borderRight: "2px solid currentColor" }}>&nbsp;</span>
      )}
    </span>
  );
};
