"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Input, Button } from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/Auth";

export default function LoginPage() {
  const { login } = useAuth();

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");

    if (!phone.trim() || !pin.trim()) {
      setError("Enter your phone number and PIN.");
      return;
    }

    setSubmitting(true);
    // No role picker: the backend figures out whether this phone number
    // belongs to the owner or a staff member and signs in accordingly.
    const result = await login(phone.trim(), pin.trim());
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || "Sign in failed. Please try again.");
    }
    // On success, AppShellInner's route guard redirects to "/" automatically.
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F4E6] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Image src="/logo-new.png" alt="Anjaneya Decorations logo" width={56} height={84} className="rounded-sm" />
          <p className="text-xl font-semibold text-[#8B4A15]" style={{ fontFamily: "var(--font-display)" }}>
            Anjaneya Decorations
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#3F6B1F]" style={{ fontFamily: "var(--font-mono)" }}>
            Tent House &middot; V.K.M
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-[#D9A427]/20 p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-[#241129]" style={{ fontFamily: "var(--font-display)" }}>
            Sign in to your account
          </h1>
          <p className="text-sm text-[#241129]/60 mt-1 mb-6">to continue to Anjaneya Decorations</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              label="Phone number"
              labelPlacement="outside"
              placeholder="Enter your phone number"
              variant="bordered"
              value={phone}
              onValueChange={setPhone}
              isRequired
              radius="sm"
            />

            <Input
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              label="PIN"
              labelPlacement="outside"
              placeholder="Enter your 4-digit PIN"
              variant="bordered"
              value={pin}
              onValueChange={(v) => setPin(v.replace(/\D/g, "").slice(0, 4))}
              isRequired
              radius="sm"
              endContent={
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  aria-label={showPin ? "Hide PIN" : "Show PIN"}
                  className="text-[#241129]/40 hover:text-[#241129]/70"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            {error && (
              <p className="text-sm text-[#6E1F3A] bg-[#6E1F3A]/5 border border-[#6E1F3A]/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              color="primary"
              radius="sm"
              className="w-full font-semibold"
              isLoading={submitting}
            >
              Sign In
            </Button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-[#241129]/10" />
            <span className="text-xs text-[#241129]/40" style={{ fontFamily: "var(--font-mono)" }}>
              OR
            </span>
            <div className="h-px flex-1 bg-[#241129]/10" />
          </div>

          <p className="text-center text-sm text-[#241129]/60">
            Need help signing in? <a href="tel:7416411182" className="text-[#8B4A15] font-medium hover:underline">Call 7416411182</a>
          </p>
        </div>
      </div>
    </div>
  );
}