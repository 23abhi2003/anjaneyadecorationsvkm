import BackButton from "@/components/BackButton";

export default function NotFound() {
  return (
    <div className="text-center py-20 space-y-4">
      <p className="text-[#F8F4E6]/60">Page not found.</p>
      <BackButton href="/" label="Back to Dashboard" />
    </div>
  );
}
