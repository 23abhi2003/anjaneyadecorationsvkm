"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Input, Button } from "@heroui/react";
import { Eye, EyeOff, Phone, Lock } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center bg-[#F8F4E6] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header with Large Prominent Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl p-2.5 bg-white border border-[#D9A427]/40 shadow-sm flex items-center justify-center mb-4">
            <Image
              src="/logo-new.png"
              alt="Anjaneya Decorations logo"
              width={140}
              height={140}
              priority
              className="w-full h-full object-contain rounded-xl"
            />
          </div>

          <h1
            className="text-2xl sm:text-3xl font-semibold text-[#8B4A15]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Anjaneya Decorations
          </h1>

          <p
            className="text-xs uppercase tracking-[0.22em] text-[#3F6B1F] mt-1.5 font-medium"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Tent House &middot; Decorations &middot; V.K.M
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#D9A427]/30 p-7 sm:p-9">
          <div className="text-center mb-8">
            <h2
              className="text-2xl font-bold text-[#5B2674] tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Sign In
            </h2>
            <p className="text-sm text-[#241129]/65 mt-1.5 max-w-xs mx-auto">
              Enter your registered mobile number &amp; PIN
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Phone Number Field with generous spacing */}
            <div className="pt-3">
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                label="Phone number"
                labelPlacement="outside"
                placeholder="Enter your phone number"
                variant="bordered"
                size="lg"
                value={phone}
                onValueChange={setPhone}
                isRequired
                radius="sm"
                classNames={{
                  label: "!text-[#5B2674] font-semibold",
                }}
                startContent={<Phone className="w-4 h-4 text-[#5B2674] shrink-0" />}
              />
            </div>

            {/* Password (PIN) Field with padding on top */}
            <div className="pt-3">
              <Input
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                label="PIN"
                labelPlacement="outside"
                placeholder="Enter your 4-digit PIN"
                variant="bordered"
                size="lg"
                value={pin}
                onValueChange={(v) => setPin(v.replace(/\D/g, "").slice(0, 4))}
                isRequired
                radius="sm"
                classNames={{
                  label: "!text-[#5B2674] font-semibold",
                  input: "font-mono tracking-[0.3em] placeholder:tracking-normal",
                }}
                startContent={<Lock className="w-4 h-4 text-[#5B2674] shrink-0" />}
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    aria-label={showPin ? "Hide PIN" : "Show PIN"}
                    className="text-[#241129]/40 hover:text-[#5B2674] p-1 transition-colors"
                    tabIndex={-1}
                  >
                    {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-[#6E1F3A] bg-[#6E1F3A]/5 border border-[#6E1F3A]/20 rounded-md px-3.5 py-2.5">
                {error}
              </p>
            )}

            {/* Sign In Button using standard UI primary color */}
            <div className="pt-1">
              <Button
                type="submit"
                color="primary"
                size="lg"
                radius="sm"
                className="w-full font-semibold text-base shadow-sm"
                isLoading={submitting}
              >
                Sign In
              </Button>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-7">
            <div className="h-px flex-1 bg-[#241129]/10" />
            <span
              className="text-xs text-[#241129]/40 uppercase tracking-wider"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              OR
            </span>
            <div className="h-px flex-1 bg-[#241129]/10" />
          </div>

          {/* Helpline */}
          <p className="text-center text-sm text-[#241129]/65">
            Need help signing in?{" "}
            <a
              href="tel:9704452180"
              className="text-[#8B4A15] font-semibold hover:underline"
            >
              Call 9704452180
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}