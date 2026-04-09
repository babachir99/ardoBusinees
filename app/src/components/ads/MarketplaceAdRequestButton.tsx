"use client";

import { useState } from "react";
import PrestaAdRequestPopup from "@/components/presta/PrestaAdRequestPopup";

type Props = {
  locale: string;
  sourceVertical: string;
  label: string;
  className: string;
};

export default function MarketplaceAdRequestButton({
  locale,
  sourceVertical,
  label,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>

      <PrestaAdRequestPopup
        open={open}
        locale={locale}
        sourceVertical={sourceVertical}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
