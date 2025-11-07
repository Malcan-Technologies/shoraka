"use client";

import * as React from "react";

interface PageTitleContextType {
  title: string;
  setTitle: (title: string) => void;
}

const PageTitleContext = React.createContext<PageTitleContextType>({
  title: "",
  setTitle: () => {},
});

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = React.useState("");

  return (
    <PageTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle() {
  return React.useContext(PageTitleContext);
}

