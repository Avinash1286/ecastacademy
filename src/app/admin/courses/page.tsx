"use client"

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  BookOpen, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Eye,
  EyeOff,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Award,
  Info,
  ChevronDown
} from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";

type CourseStatus = "draft" | "generating" | "ready" | "failed" | undefined;

type CourseWithStats = {
  id: string;
  name: string;
  description?: string;
  status?: CourseStatus;
  isPublished?: boolean;
  isCertification?: boolean;
  passingGrade?: number;
  createdAt: number;
  updatedAt: number;
  chapterCount: number;
};

const COURSES_PER_PAGE = 20;

export default function CoursesManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allCourses, setAllCourses] = useState<CourseWithStats[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithStats | null>(null);
  
  // Form states
  const [courseName, setCourseName] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [isCertification, setIsCertification] = useState(false);
  const [passingGrade, setPassingGrade] = useState("70");
  
  // Fetch courses with pagination
  const coursesData = useQuery(api.courses.getCoursesWithStats, { 
    limit: COURSES_PER_PAGE,
    cursor 
  });
  
  // Merge paginated results
  const courses = useMemo(() => {
    if (!coursesData?.courses) return allCourses;
    
    // If this is a new query (no cursor), replace all courses
    if (!cursor) {
      return coursesData.courses as CourseWithStats[];
    }
    
    // Otherwise merge with existing courses (avoiding duplicates)
    const existingIds = new Set(allCourses.map(c => c.id));
    const newCourses = coursesData.courses.filter(c => !existingIds.has(c.id as string));
    return [...allCourses, ...newCourses] as CourseWithStats[];
  }, [coursesData?.courses, cursor, allCourses]);
  
  // Update allCourses when courses change
  useMemo(() => {
    if (courses !== allCourses) {
      setAllCourses(courses);
    }
  }, [courses, allCourses]);
  
  // Load more handler
  const loadMore = useCallback(() => {
    if (coursesData?.nextCursor) {
      setCursor(coursesData.nextCursor);
    }
  }, [coursesData?.nextCursor]);
  
  // Mutations
  const updateCourse = useMutation(api.courses.updateCourse);
  const deleteCourse = useMutation(api.courses.deleteCourse);
  const togglePublish = useMutation(api.courses.togglePublishCourse);

  // Filter courses
  const filteredCourses = courses?.filter(course => {
    const matchesSearch = course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         course.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

  // Calculate statistics
  const stats = {
    total: courses?.length || 0,
    published: courses?.filter(c => c.isPublished).length || 0,
    draft: courses?.filter(c => !c.isPublished).length || 0,
    totalChapters: courses?.reduce((sum, c) => sum + (c.chapterCount || 0), 0) || 0,
  };

  const handleUpdateCourse = async () => {
    if (!selectedCourse || !courseName.trim()) {
      toast.error("Course name is required");
      return;
    }

    try {
      await updateCourse({
        id: selectedCourse.id as Id<"courses">,
        name: courseName,
        description: courseDescription || undefined,
        isCertification,
        passingGrade: isCertification ? Number(passingGrade) : undefined,
      });
      toast.success("Course updated successfully");
      setEditDialogOpen(false);
      setSelectedCourse(null);
      setCourseName("");
      setCourseDescription("");
      setIsCertification(false);
      setPassingGrade("70");
    } catch (error) {
      toast.error("Failed to update course");
      console.error(error);
    }
  };

  const handleDeleteCourse = async () => {
    if (!selectedCourse) return;

    try {
      await deleteCourse({ id: selectedCourse.id as Id<"courses"> });
      toast.success("Course deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedCourse(null);
    } catch (error) {
      toast.error("Failed to delete course");
      console.error(error);
    }
  };

  const handleTogglePublish = async (courseId: string, currentPublishStatus: boolean) => {
    try {
      await togglePublish({
        id: courseId as Id<"courses">,
        isPublished: !currentPublishStatus,
      });
      toast.success(currentPublishStatus ? "Course unpublished" : "Course published");
    } catch (error) {
      toast.error("Failed to update publish status");
      console.error(error);
    }
  };

  const openEditDialog = (course: CourseWithStats) => {
    setSelectedCourse(course);
    setCourseName(course.name);
    setCourseDescription(course.description || "");
    setIsCertification(course.isCertification || false);
    setPassingGrade(course.passingGrade?.toString() || "70");
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (course: CourseWithStats) => {
    setSelectedCourse(course);
    setDeleteDialogOpen(true);
  };

  const getStatusBadge = (status: CourseStatus) => {
    switch (status) {
      case "ready":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Ready</Badge>;
      case "generating":
        return <Badge className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Generating</Badge>;
      case "draft":
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
      case "failed":
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (courses === undefined) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="w-8 h-8" />
            Course Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your courses
          </p>
        </div>
        
        <Link href="/admin/courses/create">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Course
          </Button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Courses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 dark:text-green-500">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.published}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600 dark:text-yellow-500">Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Chapters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalChapters}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Courses List */}
      <div className="space-y-4">
        {filteredCourses.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No courses found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery ? "Try adjusting your search" : "Create your first course to get started"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredCourses.map((course) => (
            <Card key={course.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-xl">{course.name}</CardTitle>
                      {getStatusBadge(course.status)}
                      {course.isPublished && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <Eye className="w-3 h-3 mr-1" />
                          Published
                        </Badge>
                      )}
                    </div>
                    {course.description && (
                      <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                    )}
                    <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                      <span>{course.chapterCount || 0} chapters</span>
                      <span>•</span>
                      <span>Created {new Date(course.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Updated {new Date(course.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTogglePublish(course.id, course.isPublished || false)}
                    >
                      {course.isPublished ? (
                        <><EyeOff className="w-4 h-4 mr-1" />Unpublish</>
                      ) : (
                        <><Eye className="w-4 h-4 mr-1" />Publish</>
                      )}
                    </Button>
                    
                    <Link href={`/admin/courses/${course.id}/builder`}>
                      <Button variant="outline" size="sm">
                        <Settings className="w-4 h-4 mr-1" />
                        Build
                      </Button>
                    </Link>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(course)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteDialog(course)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
        
        {/* Load More Button */}
        {coursesData?.hasMore && !searchQuery && (
          <div className="flex justify-center pt-4">
            <Button 
              variant="outline" 
              onClick={loadMore}
              className="gap-2"
            >
              <ChevronDown className="w-4 h-4" />
              Load More Courses
            </Button>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update course details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Course Name</Label>
              <Input
                id="edit-name"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={courseDescription}
                onChange={(e) => setCourseDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Certification Settings Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="certification-toggle" className="text-base font-semibold flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-500" />
                    Certification Course
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Students can earn a certificate upon completion
                  </p>
                </div>
                <Switch
                  id="certification-toggle"
                  checked={isCertification}
                  onCheckedChange={setIsCertification}
                />
              </div>

              {isCertification && (
                <div className="space-y-4 pl-4 border-l-2 border-amber-500/50">
                  {/* Warning about progress recalculation */}
                  {selectedCourse && selectedCourse.isCertification !== isCertification && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-amber-900 dark:text-amber-100">
                        <p className="font-medium mb-1">Warning: Progress Recalculation</p>
                        <p>
                          Changing certification status will recalculate all student progress for this course. 
                          This may affect certificate eligibility and completion percentages.
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="passing-grade">Passing Grade (%)</Label>
                    <Input
                      id="passing-grade"
                      type="number"
                      min="0"
                      max="100"
                      value={passingGrade}
                      onChange={(e) => setPassingGrade(e.target.value)}
                      placeholder="70"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Minimum percentage required to earn the certificate (0-100)
                    </p>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-900 dark:text-blue-100">
                      <p className="font-medium mb-1">Certification Requirements:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Complete all chapters in the course</li>
                        <li>Pass all graded quizzes and assignments</li>
                        <li>Achieve at least {passingGrade}% overall course score</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCourse}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the course &ldquo;{selectedCourse?.name}&rdquo; and all its chapters.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCourse} className="bg-red-500 hover:bg-red-600">
              Delete Course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-10 w-full max-w-md" />
        </CardHeader>
      </Card>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
