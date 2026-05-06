"use client";

import * as React from "react";

export function useTypeNameCopy() {
  const [copiedTypeId, setCopiedTypeId] = React.useState<number | null>(null);

  const onCopyTypeName = async (typeId: number, typeName: string | null) => {
    try {
      await navigator.clipboard.writeText(typeName ?? String(typeId));
      setCopiedTypeId(typeId);
    } catch (err) {
      console.error("Failed to copy type name:", err);
    }
  };

  return { copiedTypeId, onCopyTypeName };
}
