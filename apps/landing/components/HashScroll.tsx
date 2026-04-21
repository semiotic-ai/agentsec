"use client";

import { useEffect } from "react";

export function HashScroll(): null {
  useEffect(() => {
    const scrollToHash = (hash: string): void => {
      if (!hash) return;
      const id = decodeURIComponent(hash.slice(1));
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const initialHash = window.location.hash;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (initialHash) {
      // Retry a few times: Next.js may reset scroll after our first attempt,
      // and images/fonts loading can shift layout.
      timers.push(setTimeout(() => scrollToHash(initialHash), 0));
      timers.push(setTimeout(() => scrollToHash(initialHash), 120));
      timers.push(setTimeout(() => scrollToHash(initialHash), 400));
    }

    const handleClick = (event: MouseEvent): void => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!target) return;
      if (target.target && target.target !== "_self") return;
      const url = new URL(target.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname !== window.location.pathname) return;
      if (!url.hash) return;
      event.preventDefault();
      if (url.hash !== window.location.hash) {
        window.history.pushState(null, "", url.hash);
      }
      scrollToHash(url.hash);
    };

    const handleHashChange = (): void => {
      scrollToHash(window.location.hash);
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      for (const id of timers) clearTimeout(id);
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return null;
}
