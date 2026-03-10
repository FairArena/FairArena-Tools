import React from "react";

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "h-4 bg-slate-700/40 rounded" }) => {
  return <div className={`animate-pulse ${className}`} />;
};

export default Skeleton;
