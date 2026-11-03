"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@heroui/react";

function RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      router.replace(`/settlements/detail?id=${encodeURIComponent(id)}`);
    } else {
      router.replace("/settlements");
    }
  }, [router, searchParams]);

  return (
    <div className="flex justify-center py-24">
      <Spinner label="Loading settlements..." />
    </div>
  );
}

export default function StaffSettlementsRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner label="Loading settlements..." />
        </div>
      }
    >
      <RedirectInner />
    </Suspense>
  );
}
