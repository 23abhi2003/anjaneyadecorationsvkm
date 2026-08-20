"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Sidebar from "@/components/Sidebar";

export default function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="panel"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed inset-y-0 left-0 z-50 w-[82vw] max-w-xs shadow-2xl md:hidden"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="absolute top-4 right-[-44px] p-2 rounded-md bg-[#F8F4E6] text-[#8B4A15] shadow-md"
            >
              <X size={20} />
            </button>
            <Sidebar onNavigate={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}