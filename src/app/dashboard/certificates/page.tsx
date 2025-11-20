"use client"

import { useQuery } from "convex/react"
import { useSession } from "next-auth/react"
import { api } from "../../../../convex/_generated/api"
import { Id } from "../../../../convex/_generated/dataModel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Award, Calendar, GraduationCap, TrendingUp, Eye, AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"

// Extend session user type to include id
interface ExtendedUser {
  id: Id<"users">
  name?: string | null
  email?: string | null
  image?: string | null
}

export default function CertificatesPage() {
  const { data: session, status } = useSession()
  
  // Get userId from session - must be valid Convex ID
  const sessionUser = session?.user as unknown as ExtendedUser | undefined
  const userId = sessionUser?.id
  
  // Only query certificates if we have a valid userId
  const certificates = useQuery(
    api.progress.getUserCertificates,
    userId && status === "authenticated" ? { userId } : "skip"
  )

  // Show loading state while checking auth or loading certificates
  if (status === "loading" || (status === "authenticated" && userId && certificates === undefined)) {
    return <CertificatesSkeleton />
  }

  // Show auth error if not authenticated
  if (status === "unauthenticated" || !session || !userId) {
    return (
      <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-destructive/10 p-6 mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              Please sign in to view your certificates.
            </p>
            <Link href="/auth/signin">
              <Button>Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No certificates earned yet
  if (!certificates || certificates.length === 0) {
    return (
      <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">My Certificates</h1>
            <p className="text-muted-foreground">View and download your earned certificates</p>
          </div>
          <Link href="/dashboard/profile" className="self-start md:self-auto">
            <Button variant="ghost" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Profile
            </Button>
          </Link>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-amber-100 dark:bg-amber-950 p-6 mb-4">
              <Award className="h-12 w-12 text-amber-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No Certificates Yet</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              Complete certification courses and pass all graded items to earn your first certificate!
            </p>
            <Link href="/dashboard">
              <Button>
                <GraduationCap className="h-4 w-4 mr-2" />
                Browse Courses
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">My Certificates</h1>
          <p className="text-muted-foreground">
            You have earned {certificates.length} certificate{certificates.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/dashboard/profile" className="self-start md:self-auto">
          <Button variant="ghost" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {certificates.map((cert) => (
          <CertificateCard
            key={cert._id}
            certificate={cert}
          />
        ))}
      </div>
    </div>
  )
}

interface CertificateCardProps {
  certificate: {
    _id: string
    certificateId: string
    courseName: string
    userName: string
    completionDate: number
    overallGrade: number
    totalGradedItems: number
    passedItems: number
    averageScore: number
  }
}

function CertificateCard({ certificate }: CertificateCardProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return "text-green-600 dark:text-green-400"
    if (grade >= 80) return "text-blue-600 dark:text-blue-400"
    if (grade >= 70) return "text-amber-600 dark:text-amber-400"
    return "text-orange-600 dark:text-orange-400"
  }

  return (
    <Card className="group hover:shadow-lg transition-shadow overflow-hidden border-l-4 border-l-amber-500">
      <CardHeader className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-5 w-5 text-amber-600" />
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                Certified
              </Badge>
            </div>
            <CardTitle className="text-2xl mb-1">{certificate.courseName}</CardTitle>
            <CardDescription className="flex items-center gap-1.5 text-sm">
              <Calendar className="h-3.5 w-3.5" />
              Completed on {formatDate(certificate.completionDate)}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className={`h-4 w-4 ${getGradeColor(certificate.overallGrade)}`} />
              <span className={`text-3xl font-bold ${getGradeColor(certificate.overallGrade)}`}>
                {Math.round(certificate.overallGrade)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Overall Grade</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Graded Items</p>
              <p className="text-lg font-bold">{certificate.passedItems}/{certificate.totalGradedItems}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Average Score</p>
              <p className="text-lg font-bold">{Math.round(certificate.averageScore)}%</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Certificate ID</p>
            <p className="text-sm font-mono">{certificate.certificateId}</p>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/certificates/${certificate.certificateId}?source=dashboard`}
              className="flex-1"
            >
              <Button className="w-full" variant="default">
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
            </Link>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/certificates/${certificate.certificateId}`
                )
                alert("Certificate link copied to clipboard!")
              }}
            >
              Share
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            This certificate verifies your achievement in completing this course
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function CertificatesSkeleton() {
  return (
    <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-6 w-96" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full mb-4" />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
