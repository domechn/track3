import { HTMLMotionProps, motion, useReducedMotion, Variants } from "framer-motion";
import React from "react";

type AccessibleMotionProps = Partial<
  Pick<HTMLMotionProps<"div">, "variants" | "initial" | "animate" | "transition">
>;

export function getAccessibleMotionProps(
  prefersReducedMotion: boolean | null,
  motionProps: AccessibleMotionProps
): AccessibleMotionProps {
  return prefersReducedMotion ? {} : motionProps;
}

export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

export const StaggerContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const prefersReducedMotion = useReducedMotion();
  const motionProps = getAccessibleMotionProps(prefersReducedMotion, {
    variants: staggerContainerVariants,
    initial: "hidden",
    animate: "show",
  });

  return (
    <motion.div {...motionProps} className={className}>
      {children}
    </motion.div>
  );
};

export const FadeUp = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const prefersReducedMotion = useReducedMotion();
  const motionProps = getAccessibleMotionProps(prefersReducedMotion, {
    variants: fadeUpVariants,
  });

  return (
    <motion.div {...motionProps} className={className}>
      {children}
    </motion.div>
  );
};

export const ScaleIn = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const prefersReducedMotion = useReducedMotion();
  const motionProps = getAccessibleMotionProps(prefersReducedMotion, {
    variants: scaleInVariants,
  });

  return (
    <motion.div {...motionProps} className={className}>
      {children}
    </motion.div>
  );
};

export const AnimatedPage = ({ children }: { children: React.ReactNode }) => {
  const prefersReducedMotion = useReducedMotion();
  const motionProps = getAccessibleMotionProps(prefersReducedMotion, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, ease: "easeOut" },
  });

  return <motion.div {...motionProps}>{children}</motion.div>;
};
