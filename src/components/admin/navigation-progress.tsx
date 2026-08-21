"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  function clearTimers() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (hideRef.current) {
      clearTimeout(hideRef.current);
      hideRef.current = null;
    }
  }

  useEffect(() => {
    if (!activeRef.current) return;

    clearTimers();
    setProgress(100);
    hideRef.current = setTimeout(() => {
      activeRef.current = false;
      setVisible(false);
      setProgress(0);
    }, 220);

    return () => {
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (anchor.hasAttribute("download") || anchor.target === "_blank") return;

      let nextPath: string;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        nextPath = `${url.pathname}${url.search}`;
      } catch {
        return;
      }

      const current = `${window.location.pathname}${window.location.search}`;
      if (nextPath === current) return;

      clearTimers();
      activeRef.current = true;
      setVisible(true);
      setProgress(14);
      tickRef.current = setInterval(() => {
        setProgress((currentProgress) => {
          if (currentProgress >= 88) return currentProgress;
          return currentProgress + Math.max(1.5, (90 - currentProgress) * 0.08);
        });
      }, 180);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-transparent"
      aria-hidden
    >
      <div
        className="h-full origin-left bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.55)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
