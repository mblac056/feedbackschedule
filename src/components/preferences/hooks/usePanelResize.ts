import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_PANEL_WIDTH = 800;
const MIN_PANEL_WIDTH = 520;
const MAX_PANEL_WIDTH = 1200;
const DESKTOP_BREAKPOINT = 1024;

export function usePanelResize() {
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [isDesktopView, setIsDesktopView] = useState(
    () => window.innerWidth >= DESKTOP_BREAKPOINT
  );
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(DEFAULT_PANEL_WIDTH);

  const getMaxPanelWidth = useCallback(
    () => Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, window.innerWidth - 80)),
    []
  );
  const clampPanelWidth = useCallback(
    (width: number) => Math.min(getMaxPanelWidth(), Math.max(MIN_PANEL_WIDTH, width)),
    [getMaxPanelWidth]
  );

  useEffect(() => {
    const handleWindowResize = () => {
      const desktop = window.innerWidth >= DESKTOP_BREAKPOINT;
      setIsDesktopView(desktop);
      if (desktop) {
        setPanelWidth((prevWidth) => clampPanelWidth(prevWidth));
      }
    };

    handleWindowResize();
    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [clampPanelWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (e: PointerEvent) => {
      const deltaX = resizeStartXRef.current - e.clientX;
      setPanelWidth(clampPanelWidth(resizeStartWidthRef.current + deltaX));
    };

    const handlePointerUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizing, clampPanelWidth]);

  const handleResizePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDesktopView) return;

    e.preventDefault();
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = panelWidth;
    setIsResizing(true);
  };

  return {
    panelWidth,
    isDesktopView,
    isResizing,
    handleResizePointerDown,
  };
}
