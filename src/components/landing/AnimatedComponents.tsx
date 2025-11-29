'use client';

import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useRef, ReactNode, useState, useEffect } from 'react';

// Fade up animation for sections
export function FadeUp({ 
  children, 
  delay = 0, 
  className = '' 
}: { 
  children: ReactNode; 
  delay?: number; 
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Stagger children animation
export function StaggerContainer({ 
  children, 
  className = '',
  staggerDelay = 0.1 
}: { 
  children: ReactNode; 
  className?: string;
  staggerDelay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Floating animation for decorative elements
export function FloatingElement({ 
  children, 
  delay = 0,
  duration = 3,
  y = 10,
  className = '' 
}: { 
  children: ReactNode; 
  delay?: number;
  duration?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      animate={{ 
        y: [-y, y, -y],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Scale on hover
export function ScaleOnHover({ 
  children, 
  scale = 1.02,
  className = '' 
}: { 
  children: ReactNode; 
  scale?: number;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Parallax scroll effect
export function ParallaxSection({ 
  children, 
  offset = 50,
  className = '' 
}: { 
  children: ReactNode; 
  offset?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });
  
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

// Gradient text animation
export function GradientText({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string;
}) {
  return (
    <motion.span
      className={`bg-gradient-to-r from-primary via-violet-500 to-fuchsia-500 bg-clip-text text-transparent bg-[length:200%_auto] ${className}`}
      animate={{
        backgroundPosition: ["0% center", "200% center"],
      }}
      transition={{
        duration: 5,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      {children}
    </motion.span>
  );
}

// Animated counter
export function AnimatedCounter({ 
  value, 
  suffix = '',
  duration = 2 
}: { 
  value: number; 
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.3 }}
      >
        {isInView && (
          <Counter from={0} to={value} duration={duration} />
        )}
        {suffix}
      </motion.span>
    </motion.span>
  );
}

function Counter({ from, to, duration }: { from: number; to: number; duration: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  
  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.span
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        onUpdate={() => {}}
      >
        <CounterInner from={from} to={to} duration={duration} />
      </motion.span>
    </motion.span>
  );
}

function CounterInner({ from, to, duration }: { from: number; to: number; duration: number }) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const [displayValue, setDisplayValue] = useState(from);
  
  useEffect(() => {
    const startTime = Date.now();
    const difference = to - from;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      
      setDisplayValue(Math.floor(from + difference * progress));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [from, to, duration]);
  
  return (
    <motion.span
      ref={nodeRef}
      animate={{ opacity: 1 }}
      transition={{ duration }}
    >
      {displayValue}
    </motion.span>
  );
}

// Glow effect wrapper
export function GlowCard({ 
  children, 
  className = '',
  glowColor = 'rgba(139, 92, 246, 0.3)'
}: { 
  children: ReactNode; 
  className?: string;
  glowColor?: string;
}) {
  return (
    <motion.div
      className={`relative ${className}`}
      whileHover="hover"
      initial="initial"
    >
      <motion.div
        className="absolute -inset-0.5 rounded-xl opacity-0 blur-xl"
        style={{ background: glowColor }}
        variants={{
          initial: { opacity: 0 },
          hover: { opacity: 0.6 },
        }}
        transition={{ duration: 0.3 }}
      />
      <div className="relative">
        {children}
      </div>
    </motion.div>
  );
}

// Typing animation for text
export function TypeWriter({ 
  text, 
  className = '',
  speed = 50 
}: { 
  text: string; 
  className?: string;
  speed?: number;
}) {
  return (
    <motion.span className={className}>
      {text.split('').map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * (speed / 1000), duration: 0.1 }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}

// Reveal text animation
export function RevealText({ 
  children, 
  className = '' 
}: { 
  children: string; 
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  
  const words = children.split(' ');
  
  return (
    <motion.span ref={ref} className={className}>
      {words.map((word, index) => (
        <span key={index} className="inline-block overflow-hidden">
          <motion.span
            className="inline-block"
            initial={{ y: '100%' }}
            animate={isInView ? { y: 0 } : { y: '100%' }}
            transition={{
              duration: 0.5,
              delay: index * 0.1,
              ease: [0.25, 0.4, 0.25, 1],
            }}
          >
            {word}&nbsp;
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

// Pulse animation for CTA
export function PulseButton({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string;
}) {
  return (
    <motion.div
      className={`relative ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <motion.div
        className="absolute inset-0 rounded-lg bg-primary/50"
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.5, 0, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {children}
    </motion.div>
  );
}

// Animated border gradient
export function AnimatedBorder({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string;
}) {
  return (
    <div className={`relative p-[1px] rounded-xl overflow-hidden ${className}`}>
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4, #8b5cf6)',
          backgroundSize: '300% 100%',
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      <div className="relative bg-background rounded-xl">
        {children}
      </div>
    </div>
  );
}

// Marquee for scrolling content
export function Marquee({ 
  children, 
  speed = 30,
  className = '' 
}: { 
  children: ReactNode; 
  speed?: number;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <motion.div
        className="flex gap-8"
        animate={{
          x: [0, '-50%'],
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: 'loop',
            duration: speed,
            ease: 'linear',
          },
        }}
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
}
