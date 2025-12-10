"use client"

import { useAuth } from "@/hooks/useAuth"
import { useQuery } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import { Id } from "../../../../convex/_generated/dataModel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Award, Calendar, TrendingUp, Eye, Mail, User as UserIcon, GraduationCap, Shield, Sun, Moon, Monitor } from "lucide-react"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import Link from "next/link"

// Extend session user type to include id
interface ExtendedUser {
  id: Id<"users">
  name?: string | null
  email?: string | null
  image?: string | null
  role?: string
}

export default function ProfilePage() {
  const { data: session, status } = useAuth()
  const { theme, setTheme } = useTheme()

  // Get userId from session
  const sessionUser = session?.user as unknown as ExtendedUser | undefined
  const userId = sessionUser?.id
  
  // Query certificates with userId
  const certificates = useQuery(
    api.progress.getUserCertificates,
    userId && status === "authenticated" ? { userId } : "skip"
  )
  
  // Query current user data to get the latest name
  const currentUser = useQuery(
    api.clerkAuth.getUserById,
    userId && status === "authenticated" ? { id: userId } : "skip"
  )
  
  // Query enrolled courses count
  const enrolledCourses = useQuery(
    api.courses.getEnrolledCourses,
    userId && status === "authenticated" ? { userId } : "skip"
  )
  
  // Get the display name (prefer database name over session name)
  const displayName = currentUser?.name || sessionUser?.name || "User"

  // Show loading state
  if (status === "loading" || (status === "authenticated" && userId && (certificates === undefined || currentUser === undefined))) {
    return <ProfileSkeleton />
  }

  // Redirect if not authenticated
  if (status === "unauthenticated" || !session || !userId) {
    return (
      <div className="container mx-auto max-w-4xl py-12 px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <h2 className="text-2xl font-semibold mb-2">Please Sign In</h2>
            <p className="text-muted-foreground mb-6">You need to be signed in to view your profile.</p>
            <Link href="/auth/signin">
              <Button>Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const user = sessionUser as ExtendedUser
  const initials = displayName
    ? displayName.split(" ").map((n) => n[0]).join("").toUpperCase()
    : user.email?.charAt(0).toUpperCase() || "U"

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4 sm:px-6 lg:px-8">
      {/* Profile Header */}
      <Card className="mb-8">
        <CardContent className="pt-8">
          <div className="flex flex-col items-center text-center">
            {/* Profile Picture */}
            <Avatar className="h-32 w-32 mb-4 border-4 border-primary/20">
              <AvatarImage src={user.image || undefined} alt={displayName} />
              <AvatarFallback className="text-4xl font-bold bg-gradient-to-br from-primary/20 to-primary/10">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Username */}
            <h1 className="text-3xl font-bold mb-2">{displayName}</h1>
            
            {/* Email & Role */}
            <div className="flex flex-col sm:flex-row items-center gap-3 text-muted-foreground mb-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="text-sm">{user.email}</span>
              </div>
              {user.role && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"} className="gap-1">
                    {user.role === "admin" ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Badge>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-xs mt-6">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-2xl font-bold text-amber-600">{certificates?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Certificates</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-2xl font-bold text-blue-600">{enrolledCourses?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Enrolled Courses</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="certificates" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
          <TabsTrigger value="certificates" className="gap-2">
            <Award className="h-4 w-4" />
            Certificates
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <UserIcon className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Certificates Tab */}
        <TabsContent value="certificates" className="mt-6">
          {!certificates || certificates.length === 0 ? (
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
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold">My Certificates</h2>
                  <p className="text-muted-foreground">
                    You have earned {certificates.length} certificate{certificates.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {certificates.map((cert) => (
                  <CertificateCard key={cert._id} certificate={cert} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Manage your account settings and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Name Field (read-only) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Name</Label>
                <p className="text-muted-foreground">{displayName}</p>
              </div>

              {/* Email Field (Read-only) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Email</Label>
                <p className="text-muted-foreground">{user.email}</p>
              </div>

              {/* Role Field (Read-only) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Role</Label>
                <p className="text-muted-foreground">{user.role || "user"}</p>
              </div>

              {/* Divider */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Appearance</h3>
                
                {/* Theme Toggle */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Theme</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Choose your preferred color scheme
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("light")}
                      className="gap-2"
                    >
                      <Sun className="h-4 w-4" />
                      Light
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("dark")}
                      className="gap-2"
                    >
                      <Moon className="h-4 w-4" />
                      Dark
                    </Button>
                    <Button
                      variant={theme === "system" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("system")}
                      className="gap-2"
                    >
                      <Monitor className="h-4 w-4" />
                      System
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
            <CardTitle className="text-xl mb-1">{certificate.courseName}</CardTitle>
            <CardDescription className="flex items-center gap-1.5 text-sm">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(certificate.completionDate)}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className={`h-4 w-4 ${getGradeColor(certificate.overallGrade)}`} />
              <span className={`text-2xl font-bold ${getGradeColor(certificate.overallGrade)}`}>
                {Math.round(certificate.overallGrade)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Grade</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-muted/50 border">
              <p className="text-xs font-semibold text-muted-foreground mb-0.5">Passed</p>
              <p className="text-sm font-bold">{certificate.passedItems}/{certificate.totalGradedItems}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 border">
              <p className="text-xs font-semibold text-muted-foreground mb-0.5">Avg Score</p>
              <p className="text-sm font-bold">{Math.round(certificate.averageScore)}%</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Link href={`/dashboard/certificates/${certificate.certificateId}`} className="flex-1">
              <Button className="w-full" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
            </Link>
            <Button 
              size="sm"
              variant="outline" 
              className="flex-1"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/dashboard/certificates/${certificate.certificateId}`
                )
                toast.success("Certificate link copied to clipboard!")
              }}
            >
              Share
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProfileSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl py-8 px-4 sm:px-6 lg:px-8">
      <Card className="mb-8">
        <CardContent className="pt-8">
          <div className="flex flex-col items-center text-center">
            <Skeleton className="h-32 w-32 rounded-full mb-4" />
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-5 w-64 mb-4" />
            <div className="grid grid-cols-3 gap-4 w-full max-w-md mt-6">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Skeleton className="h-12 w-full max-w-md mx-auto mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}
