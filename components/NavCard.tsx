"use client";

import Link from "next/link";
import { Card, CardBody } from "@heroui/react";

interface NavCardProps {
  href: string;
  title: string;
  count: number;
  sub: string;
}

export default function NavCard({ href, title, count, sub }: NavCardProps) {
  return (
    <Card as={Link} href={href} isPressable isHoverable className="bg-content1">
      <CardBody className="p-5">
        <p className="text-3xl text-warning" style={{ fontFamily: "var(--font-display)" }}>
          {count}
        </p>
        <p className="text-lg text-foreground mt-1" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </p>
        <p className="text-xs text-foreground/50 mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
          {sub}
        </p>
      </CardBody>
    </Card>
  );
}
