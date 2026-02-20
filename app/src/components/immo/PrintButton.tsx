"use client";

type Props = {
  label: string;
  className?: string;
};

export default function PrintButton({ label, className }: Props) {
  return (
    <button
      type="button"
      onClick={() => {
        window.print();
      }}
      className={className}
    >
      {label}
    </button>
  );
}
