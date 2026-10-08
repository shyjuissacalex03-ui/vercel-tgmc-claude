import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface RouterContextType {
  pathname: string;
  navigate: (href: string) => void;
}

const RouterContext = createContext<RouterContextType>({
  pathname: "/",
  navigate: () => {},
});

/** "/events/?x=1#top" -> "/events" (so "/about/" and "/about" are the same page). */
function normalizePath(path: string): string {
  const clean = (path || "/").split(/[?#]/)[0] || "/";
  return clean.length > 1 && clean.endsWith("/") ? clean.replace(/\/+$/, "") || "/" : clean;
}

const isExternalHref = (href: string) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href);

export const useRouter = () => {
  const ctx = useContext(RouterContext);
  return {
    pathname: ctx.pathname,
    push: ctx.navigate,
  };
};

export const usePathname = () => {
  const ctx = useContext(RouterContext);
  return ctx.pathname;
};

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== "undefined" ? normalizePath(window.location.pathname) : "/"
  );

  useEffect(() => {
    const handlePopState = () => {
      setPathname(normalizePath(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((href: string) => {
    if (isExternalHref(href)) {
      window.location.href = href;
      return;
    }
    const target = normalizePath(href);
    if (target !== normalizePath(window.location.pathname) || href !== target) {
      // Keep any ?query / #hash in the address bar, but route on the clean path.
      window.history.pushState({}, "", href);
    }
    setPathname(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const value = useMemo(() => ({ pathname, navigate }), [pathname, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const Link: React.FC<LinkProps> = ({ href, children, className = "", onClick, ...props }) => {
  const { navigate } = useContext(RouterContext);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);
    // Let the browser handle new-tab / new-window clicks and external links.
    const opensElsewhere =
      e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey ||
      (props.target && props.target !== "_self") || props.download !== undefined;
    if (e.defaultPrevented || opensElsewhere || isExternalHref(href)) return;
    e.preventDefault();
    navigate(href);
  };

  return (
    <a href={href} className={className} {...props} onClick={handleClick}>
      {children}
    </a>
  );
};

export default Link;
