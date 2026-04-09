"use client";

import { useState, useCallback, useRef, type ReactNode } from "react";

interface Props {
  left: ReactNode;
  right: ReactNode;
  defaultRightWidth?: number;
  minRightWidth?: number;
  maxRightWidth?: number;
}

export default function ResizableLayout({
  left,
  right,
  defaultRightWidth = 384,
  minRightWidth = 280,
  maxRightWidth = 600,
}: Props) {
  const [rightWidth, setRightWidth] = useState(defaultRightWidth);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setRightWidth(Math.min(maxRightWidth, Math.max(minRightWidth, newWidth)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [minRightWidth, maxRightWidth]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 min-w-0">{left}</div>
      <div
        onMouseDown={handleMouseDown}
        className="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize shrink-0"
      />
      <div className="shrink-0 overflow-hidden" style={{ width: rightWidth }}>
        {right}
      </div>
    </div>
  );
}
