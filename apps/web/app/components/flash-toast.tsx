"use client";

import { useEffect, useRef, useState } from "react";

export type ToastItem = {
  id: string;
  tone: "success" | "error";
  message: string;
  title?: string;
};

type FlashToastProps = {
  items: ToastItem[];
};

export function FlashToast({ items }: FlashToastProps) {
  const [visibleItems, setVisibleItems] = useState(items);
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setVisibleItems(items);
  }, [items]);

  useEffect(() => {
    const activeIds = new Set(visibleItems.map((item) => item.id));

    visibleItems.forEach((item) => {
      if (timeoutsRef.current.has(item.id)) {
        return;
      }

      const timeout = window.setTimeout(() => {
        setVisibleItems((current) => current.filter((entry) => entry.id !== item.id));
        timeoutsRef.current.delete(item.id);
      }, 5200);

      timeoutsRef.current.set(item.id, timeout);
    });

    timeoutsRef.current.forEach((timeout, id) => {
      if (activeIds.has(id)) {
        return;
      }

      window.clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    });
  }, [visibleItems]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  if (!visibleItems.length) {
    return null;
  }

  return (
    <div className="flash-toast-stack" aria-live="polite" aria-atomic="true">
      {visibleItems.map((item) => (
        <div key={item.id} className={`flash-toast ${item.tone}`} role={item.tone === "error" ? "alert" : "status"}>
          <div className="flash-toast-accent" aria-hidden="true" />
          <div className="flash-toast-icon" aria-hidden="true">
            {item.tone === "success" ? "OK" : "!"}
          </div>
          <div className="flash-toast-body">
            <strong className="flash-toast-title">{item.title ?? (item.tone === "success" ? "Success" : "Action required")}</strong>
            <p className="flash-toast-message">{item.message}</p>
          </div>
          <button
            type="button"
            className="flash-toast-close"
            aria-label="Dismiss notification"
            onClick={() => setVisibleItems((current) => current.filter((entry) => entry.id !== item.id))}
          >
            x
          </button>
          <span className="flash-toast-timer" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
