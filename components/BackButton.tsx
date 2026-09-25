"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  href?: string;
  label?: string;
  className?: string;
}

export default function BackButton({ href, label = "Back", className = "" }: BackButtonProps) {
  const router = useRouter();

  if (href) {
    return (
      <Button
        as={Link}
        href={href}
        variant="flat"
        radius="sm"
        size="sm"
        startContent={<ArrowLeft size={16} className="shrink-0 transition-transform group-hover:-translate-x-0.5" />}
        className={`group font-medium text-[#F8F4E6]/85 hover:text-[#D9A427] bg-[#F8F4E6]/5 hover:bg-[#D9A427]/15 border border-[#D9A427]/30 hover:border-[#D9A427]/60 transition-all ${className}`}
      >
        {label}
      </Button>
    );
  }

  return (
    <Button
      variant="flat"
      radius="sm"
      size="sm"
      onPress={() => router.back()}
      startContent={<ArrowLeft size={16} className="shrink-0 transition-transform group-hover:-translate-x-0.5" />}
      className={`group font-medium text-[#F8F4E6]/85 hover:text-[#D9A427] bg-[#F8F4E6]/5 hover:bg-[#D9A427]/15 border border-[#D9A427]/30 hover:border-[#D9A427]/60 transition-all ${className}`}
    >
      {label}
    </Button>
  );
}

