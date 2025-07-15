const SkeletonCard = () => (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="w-full aspect-video bg-muted animate-pulse"></div>
      <div className="p-4 space-y-4">
        <div className="h-5 rounded bg-muted w-3/4 animate-pulse"></div>
        <div className="space-y-2">
          <div className="h-4 rounded bg-muted w-full animate-pulse"></div>
          <div className="h-4 rounded bg-muted w-5/6 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
  
  export const CourseGridSkeleton = () => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );