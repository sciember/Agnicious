"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { MobileAppSidebar } from "@/components/layout/app-sidebar";
import { useMobileSidebar } from "@/components/layout/mobile-sidebar-context";

export function MobileSidebarDrawer() {
  const { open, closeSidebar } = useMobileSidebar();
  const pathname = usePathname();

  useEffect(() => {
    // Close on navigation.
    closeSidebar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={closeSidebar}
          />
          <motion.div
            className="absolute inset-y-0 left-0"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <MobileAppSidebar onClose={closeSidebar} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

