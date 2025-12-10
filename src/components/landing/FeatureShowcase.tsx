'use client';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface FeatureShowcaseProps {
  title: string;
  description: string;
  features: string[];
  /** 
   * PLACEHOLDER: Add your image/video here
   * Recommended size: 600x400px for images, 16:9 aspect ratio for videos
   */
  mediaType: 'image' | 'video';
  mediaSrc?: string;
  mediaAlt: string;
  reversed?: boolean;
  accentColor?: string;
  className?: string;
}

export function FeatureShowcase({
  title,
  description,
  features,
  mediaType,
  mediaSrc,
  mediaAlt,
  reversed = false,
  accentColor = 'primary',
  className = '',
}: FeatureShowcaseProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const toggleVideo = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const contentOrder = reversed ? 'md:order-2' : 'md:order-1';
  const mediaOrder = reversed ? 'md:order-1' : 'md:order-2';

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.6 }}
      className={cn("grid md:grid-cols-2 gap-8 lg:gap-16 items-center", className)}
    >
      {/* Content */}
      <motion.div
        className={cn("space-y-6", contentOrder)}
        initial={{ opacity: 0, x: reversed ? 50 : -50 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold">
          {title}
        </h3>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {description}
        </p>
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className={cn(
                "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
                `bg-${accentColor}/20`
              )}>
                <div className={cn("w-2 h-2 rounded-full", `bg-${accentColor}`)} />
              </div>
              <span className="text-muted-foreground">{feature}</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>

      {/* Media */}
      <motion.div
        className={cn("relative", mediaOrder)}
        initial={{ opacity: 0, x: reversed ? -50 : 50 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <div className="relative rounded-xl overflow-hidden border border-border bg-card shadow-2xl">
          {/* Gradient overlay */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-tr opacity-10 z-10 pointer-events-none",
            `from-${accentColor}/30 to-transparent`
          )} />
          
          {mediaType === 'video' && mediaSrc ? (
            <div className="relative aspect-video">
              <video
                ref={videoRef}
                src={mediaSrc}
                className="w-full h-full object-cover"
                loop
                muted
                playsInline
              />
              <button
                onClick={toggleVideo}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group"
              >
                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-foreground" />
                  ) : (
                    <Play className="w-6 h-6 text-foreground ml-1" />
                  )}
                </div>
              </button>
            </div>
          ) : mediaSrc ? (
            <div className="relative w-full">
              <Image
                src={mediaSrc}
                alt={mediaAlt}
                width={1920}
                height={1080}
                quality={85}
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          ) : (
            /* Placeholder when no media is provided */
            <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
              <div className="text-center p-8">
                <div className={cn(
                  "w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center",
                  `bg-${accentColor}/20`
                )}>
                  <div className={cn("w-8 h-8 rounded-lg", `bg-${accentColor}/40`)} />
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  {mediaAlt}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {mediaType === 'video' ? 'Add demo video' : 'Add screenshot'}
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Decorative elements */}
        {!prefersReducedMotion ? (
          <motion.div
            className={cn(
              "absolute -z-10 w-72 h-72 rounded-full blur-3xl opacity-20",
              `bg-${accentColor}`,
              reversed ? "-top-20 -left-20" : "-bottom-20 -right-20"
            )}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.3, 0.2],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ) : (
          <div
            className={cn(
              "absolute -z-10 w-72 h-72 rounded-full blur-3xl opacity-20",
              `bg-${accentColor}`,
              reversed ? "-top-20 -left-20" : "-bottom-20 -right-20"
            )}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

// Browser mockup for screenshots
export function BrowserMockup({ 
  children, 
  url = "ecastacademy.com",
  className = '' 
}: { 
  children: React.ReactNode; 
  url?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl overflow-hidden border border-border bg-card shadow-2xl", className)}>
      {/* Browser header */}
      <div className="bg-muted/50 border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <div className="flex-1 max-w-md mx-auto">
          <div className="bg-background rounded-md px-3 py-1.5 text-xs text-muted-foreground text-center border border-border">
            {url}
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}

// Phone mockup for mobile screenshots
export function PhoneMockup({ 
  children,
  className = '' 
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {/* Phone frame */}
      <div className="relative bg-foreground rounded-[2.5rem] p-2 shadow-2xl">
        <div className="bg-background rounded-[2rem] overflow-hidden">
          {/* Notch */}
          <div className="bg-foreground h-7 flex items-center justify-center">
            <div className="w-20 h-5 bg-background rounded-full" />
          </div>
          {/* Screen content */}
          <div className="aspect-[9/19.5]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// Interactive demo card with hover effects
export function DemoCard({
  icon,
  title,
  description,
  demoContent,
  className = '',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  demoContent?: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -5 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:shadow-xl hover:border-primary/30",
        className
      )}
    >
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative z-10">
        {/* Icon */}
        <motion.div
          className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
          whileHover={{ rotate: 5 }}
        >
          {icon}
        </motion.div>
        
        {/* Title & Description */}
        <h4 className="text-lg font-semibold mb-2">{title}</h4>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        
        {/* Demo content area */}
        {demoContent && (
          <div className="mt-4 pt-4 border-t border-border">
            {demoContent}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Animated stats card
export function StatCard({
  value,
  label,
  icon,
  delay = 0,
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.05 }}
      className="relative overflow-hidden rounded-xl border border-border bg-card p-6 text-center"
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
          {icon}
        </div>
        <div className="text-3xl font-bold mb-1">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </motion.div>
  );
}
