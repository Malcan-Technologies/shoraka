"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useNavigationGuard (production-grade)
 *
 * UI-agnostic guard that never calls router.
 * onConfirmNavigation receives the pending path (or "__BACK__" sentinel).
 */
export function useNavigationGuard(
  hasUnsavedChanges: boolean,
  onConfirmNavigation: (path: string) => void
) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const hasUnsavedRef = useRef<boolean>(hasUnsavedChanges);
  const isModalOpenRef = useRef<boolean>(false);
  const hasPushedHistoryRef = useRef<boolean>(false);

  useEffect(() => {
    hasUnsavedRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    isModalOpenRef.current = isModalOpen;
  }, [isModalOpen]);

  // beforeunload handler active only when unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    if (hasUnsavedChanges) window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // pushState once when unsaved becomes true
  useEffect(() => {
    if (hasUnsavedChanges && !hasPushedHistoryRef.current) {
      try {
        window.history.pushState(null, "", window.location.href);
        hasPushedHistoryRef.current = true;
      } catch {}
    }
    if (!hasUnsavedChanges) hasPushedHistoryRef.current = false;
  }, [hasUnsavedChanges]);

  // popstate installed once
  useEffect(() => {
    const handlePop = () => {
      if (!hasUnsavedRef.current) return;
      if (isModalOpenRef.current) {
        try {
          window.history.pushState(null, "", window.location.href);
        } catch {}
        return;
      }
      try {
        window.history.pushState(null, "", window.location.href);
      } catch {}
      setPendingPath("__BACK__");
      setIsModalOpen(true);
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // auto-close modal if unsaved cleared
  useEffect(() => {
    if (!hasUnsavedRef.current && isModalOpenRef.current) {
      setIsModalOpen(false);
      setPendingPath(null);
    }
  }, [hasUnsavedChanges]);

  const requestNavigation = useCallback(
    (path: string) => {
      if (isModalOpenRef.current) return;
      if (!hasUnsavedRef.current) {
        onConfirmNavigation(path);
        return;
      }
      setPendingPath(path);
      setIsModalOpen(true);
    },
    [onConfirmNavigation]
  );

  const confirmLeave = useCallback(() => {
    if (!pendingPath) return;
    setIsModalOpen(false);
    onConfirmNavigation(pendingPath);
    setPendingPath(null);
  }, [onConfirmNavigation, pendingPath]);

  const cancelLeave = useCallback(() => {
    setIsModalOpen(false);
    setPendingPath(null);
  }, []);

  return { isModalOpen, requestNavigation, confirmLeave, cancelLeave, pendingPath };
}

