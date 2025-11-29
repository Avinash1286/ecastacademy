"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import { Id } from "../../../../convex/_generated/dataModel"
import { EnrollButton } from "@/components/course/EnrollButton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Award, BookOpen, Video, ArrowLeft } from "lucide-react"
import Image from "next/image"

const Page = () => {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as Id<"courses">
  
  const course = useQuery(api.courses.getCourse, { id: courseId })
  const chapters = useQuery(api.chapters.getChaptersByCourse, { courseId })

  if (course === undefined || chapters === undefined) {
    return <CourseDetailsSkeleton />
  }

  if (!course) {
    return (
      <>
        {/* Sticky Navbar */}
        <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => router.back()}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        </div>
        
        <div className="container mx-auto max-w-7xl py-12 px-4 text-center">
          <h1 className="text-2xl font-bold">Course not found</h1>
        </div>
      </>
    )
  }

  type ChapterSummary = {
    _id: Id<'chapters'>
    name: string
    contentItems?: Array<{ _id: string }> | null
  }

  const chapterSummaries = (chapters ?? []) as ChapterSummary[]

  const totalChapters = chapterSummaries.length
  const totalContentItems = chapterSummaries.reduce((acc, chapter) => acc + (chapter.contentItems?.length ?? 0), 0)

  return (
    <>
      {/* Sticky Navbar */}
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.back()}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Enroll Card - Shows first on mobile, sidebar on desktop */}
          <div className="lg:col-span-1 order-first lg:order-last">
            <Card className="lg:sticky lg:top-20">
              <CardHeader>
                <CardTitle>Start Learning</CardTitle>
                <CardDescription>Enroll now to access all course content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <EnrollButton courseId={courseId} size="lg" className="w-full" />
                
                {course.isCertification && (
                  <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20">
                    <div className="flex items-start gap-2">
                      <Award className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">Certificate of Completion</h4>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Complete all graded items with {course.passingGrade || 70}% or higher to earn your certificate.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 order-last lg:order-first space-y-6">
            <div>
            <div className="flex items-start gap-4 mb-4">
              <h1 className="text-4xl font-bold flex-1">{course.name}</h1>
              {course.isCertification && (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                  <Award className="h-4 w-4 mr-1" />
                  Certificate Course
                </Badge>
              )}
            </div>
            <p className="text-lg text-muted-foreground">
              {course.description || "No description available"}
            </p>
          </div>

          {course.thumbnailUrl && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden">
              <Image src={course.thumbnailUrl} alt={course.name} fill className="object-cover" />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{totalChapters}</p>
                    <p className="text-sm text-muted-foreground">Chapters</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{totalContentItems}</p>
                    <p className="text-sm text-muted-foreground">Content Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {course.isCertification && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-2xl font-bold">{course.passingGrade || 70}%</p>
                      <p className="text-sm text-muted-foreground">Passing Grade</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Course Curriculum</CardTitle>
              <CardDescription>{totalChapters} chapters  {totalContentItems} content items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {chapterSummaries.map((chapter, index) => (
                  <div key={chapter._id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{chapter.name}</h4>
                      <p className="text-sm text-muted-foreground">{chapter.contentItems?.length || 0} items</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  )
}

function CourseDetailsSkeleton() {
  return (
    <>
      {/* Sticky Navbar Skeleton */}
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center">
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </div>
      
      <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="w-full aspect-video" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </div>
          <div className="lg:col-span-1">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    </>
  )
}

export default Page
