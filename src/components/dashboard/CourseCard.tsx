'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Course } from '@/lib/types';

export const CourseCard = ({ course }: { course: Course }) => (
  <Link
    href={`/coursedetails/${course.id}`}
    className="group block rounded-lg border border-border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/50 transform hover:-translate-y-1"
  >
    <div className="relative w-full aspect-video bg-muted">
      {course.thumbnailUrl ? (
        <>
          <Image
            src={course.thumbnailUrl}
            alt={`Thumbnail for ${course.name}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            style={{ objectFit: 'cover' }}
            className="transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
          <BookOpen className="w-20 h-20 text-muted-foreground/40" />
        </div>
      )}
      
      {/* Certification Badge */}
      {course.isCertification && (
        <div className="absolute top-3 right-3">
          <Badge className="bg-amber-500/90 hover:bg-amber-500 text-white border-none shadow-lg">
            <Award className="h-3 w-3 mr-1" />
            Certificate
          </Badge>
        </div>
      )}
    </div>
    <div className="p-4">
      <h3 className="text-lg font-bold text-card-foreground truncate group-hover:text-primary transition-colors">
        {course.name}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
        {course.description || 'No description available for this course.'}
      </p>
    </div>
  </Link>
);