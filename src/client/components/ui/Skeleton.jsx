import React from 'react';
import './Skeleton.css';

/** Placeholder block shaped like the content it stands in for. */
export default function Skeleton({ width = '100%', height = 16, radius, className = '', style }) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}
