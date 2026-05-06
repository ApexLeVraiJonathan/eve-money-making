"use client";

import * as React from "react";

export function useReturnUrl() {
  const [url, setUrl] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setUrl(window.location.origin + "/settings/notifications");
    }
  }, []);

  return url;
}
