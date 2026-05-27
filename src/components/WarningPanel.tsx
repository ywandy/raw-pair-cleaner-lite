import { AlertTriangle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

interface WarningPanelProps {
  title: string;
  children: React.ReactNode;
  tone?: "orange" | "red" | "blue";
}

const TONES = {
  orange: "alert-orange",
  red: "alert-red",
  blue: "alert-blue"
};

export function WarningPanel({ title, children, tone = "orange" }: WarningPanelProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={`alert-panel ${TONES[tone]}`}
      initial={{ opacity: 0, y: reduced ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.01 : 0.18, ease: "easeOut" }}
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <div className="type-ui">{title}</div>
        <div className="type-body mt-1">{children}</div>
      </div>
    </motion.div>
  );
}
