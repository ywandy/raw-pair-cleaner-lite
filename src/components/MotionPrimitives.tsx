import type { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";

const EASE_OUT = "easeOut";
const EASE_IN = "easeIn";

export function MotionPage({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -4 }}
      transition={{ duration: reduced ? 0.01 : 0.22, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

export function MotionStack({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();

  return (
    <motion.div className={className} variants={staggerContainer(reduced)} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function MotionItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();

  return (
    <motion.div className={className} variants={fadeUpItem(reduced)}>
      {children}
    </motion.div>
  );
}

export function getPressMotion(reduced: boolean | null) {
  if (reduced) return {};
  return {
    whileTap: { scale: 0.985 }
  };
}

export function getCardPressMotion(reduced: boolean | null) {
  if (reduced) return {};
  return {
    whileTap: { scale: 0.99 }
  };
}

export function dialogScrimVariants(reduced: boolean | null): Variants {
  return {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: reduced ? 0.01 : 0.16, ease: EASE_OUT } },
    exit: { opacity: 0, transition: { duration: reduced ? 0.01 : 0.12, ease: EASE_IN } }
  };
}

export function dialogPanelVariants(reduced: boolean | null): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : 8, scale: reduced ? 1 : 0.985 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: reduced ? 0.01 : 0.2, ease: EASE_OUT } },
    exit: { opacity: 0, y: reduced ? 0 : 4, scale: reduced ? 1 : 0.99, transition: { duration: reduced ? 0.01 : 0.13, ease: EASE_IN } }
  };
}

export function fadeUpItem(reduced: boolean | null): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : 6 },
    show: { opacity: 1, y: 0, transition: { duration: reduced ? 0.01 : 0.22, ease: EASE_OUT } }
  };
}

export function staggerContainer(reduced: boolean | null): Variants {
  return {
    hidden: {},
    show: {
      transition: reduced
        ? {}
        : {
            staggerChildren: 0.045,
            delayChildren: 0.025
          }
    }
  };
}

export function treeChildrenVariants(reduced: boolean | null): Variants {
  return {
    hidden: { height: 0, opacity: 0 },
    show: {
      height: "auto",
      opacity: 1,
      transition: { duration: reduced ? 0.01 : 0.2, ease: EASE_OUT }
    },
    exit: {
      height: 0,
      opacity: 0,
      transition: { duration: reduced ? 0.01 : 0.14, ease: EASE_IN }
    }
  };
}
