"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Award, Calendar, CheckCircle, Download, GraduationCap, TrendingUp } from "lucide-react"

interface CertificateViewProps {
  certificateId: string
  backHref?: string
  backLabel?: string
  verificationPath?: string
}

export function CertificateView({
  certificateId,
  backHref,
  backLabel = "Back",
  verificationPath = "/certificates",
}: CertificateViewProps) {
  const certificate = useQuery(api.progress.getCertificate, { certificateId })

  const normalizedVerificationPath = useMemo(() => {
    if (!verificationPath) {
      return "/certificates"
    }
    if (verificationPath.startsWith("http")) {
      return verificationPath
    }
    return verificationPath.startsWith("/") ? verificationPath : `/${verificationPath}`
  }, [verificationPath])

  const fallbackVerificationLink = useMemo(() => {
    const base = normalizedVerificationPath.replace(/\/$/, "")
    return `${base}/${certificateId}`
  }, [certificateId, normalizedVerificationPath])

  const [verificationLink, setVerificationLink] = useState<string>(fallbackVerificationLink)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const base = normalizedVerificationPath.startsWith("http")
      ? normalizedVerificationPath
      : `${window.location.origin}${normalizedVerificationPath}`
    const sanitizedBase = base.replace(/\/$/, "")
    setVerificationLink(`${sanitizedBase}/${certificateId}`)
  }, [certificateId, normalizedVerificationPath])

  if (certificate === undefined) {
    return <CertificateViewSkeleton hasBackLink={Boolean(backHref)} />
  }

  if (!certificate) {
    return (
      <div className="container mx-auto max-w-4xl py-12 px-4 text-center">
        <div className="rounded-full bg-destructive/10 p-6 w-fit mx-auto mb-4">
          <Award className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Certificate Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The certificate you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        {backHref ? (
          <Link href={backHref}>
            <Button>{backLabel}</Button>
          </Link>
        ) : (
          <Link href="/">
            <Button>Go to Homepage</Button>
          </Link>
        )}
      </div>
    )
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50/30 dark:from-amber-950/10 dark:via-background dark:to-amber-950/5 py-12 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="flex justify-between items-center mb-8 print:hidden">
          {backHref ? (
            <Link href={backHref}>
              <Button variant="ghost">&larr; {backLabel}</Button>
            </Link>
          ) : (
            <div className="h-10" />
          )}
          <Button onClick={handlePrint}>
            <Download className="h-4 w-4 mr-2" />
            Download / Print
          </Button>
        </div>

        <Card className="border-4 border-amber-500 shadow-2xl bg-white dark:bg-card print:shadow-none">
          <CardContent className="p-12 md:p-16">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500 mb-4">
                <Award className="h-12 w-12 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-amber-900 dark:text-amber-100 mb-2">
                Certificate of Completion
              </h1>
              <div className="w-32 h-1 bg-amber-500 mx-auto" />
            </div>

            <div className="text-center space-y-6 mb-8">
              <p className="text-lg text-muted-foreground">This certifies that</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                {certificate.userName}
              </h2>
              <p className="text-lg text-muted-foreground">has successfully completed</p>
              <h3 className="text-2xl md:text-3xl font-semibold text-amber-900 dark:text-amber-100 px-4">
                {certificate.courseName}
              </h3>

              <div className="flex items-center justify-center gap-8 pt-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                    <span className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                      {Math.round(certificate.overallGrade)}%
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">Overall Grade</p>
                </div>

                <div className="h-12 w-px bg-border" />

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-3xl font-bold text-green-900 dark:text-green-100">
                      {certificate.passedItems}/{certificate.totalGradedItems}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">Items Completed</p>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-amber-200 dark:border-amber-800 pt-8 mt-8">
              <div className="flex justify-between items-end">
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Date of Completion</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {formatDate(certificate.completionDate)}
                  </p>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end text-muted-foreground mb-2">
                    <GraduationCap className="h-4 w-4" />
                    <span className="text-sm">ECAST Academy</span>
                  </div>
                  <div className="w-32 h-px bg-foreground" />
                  <p className="text-xs text-muted-foreground mt-1">Authorized Signature</p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-border/50 text-center">
                <p className="text-xs text-muted-foreground mb-1">Certificate ID</p>
                <p className="text-sm font-mono text-foreground">{certificate.certificateId}</p>
                <p className="text-xs text-muted-foreground mt-4">
                  This certificate can be verified at {verificationLink}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 print:hidden">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-600 mb-1">
                  {Math.round(certificate.averageScore)}%
                </p>
                <p className="text-sm text-muted-foreground">Average Score</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600 mb-1">
                  {certificate.passedItems}
                </p>
                <p className="text-sm text-muted-foreground">Passed Items</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600 mb-1">
                  {certificate.totalGradedItems}
                </p>
                <p className="text-sm text-muted-foreground">Total Graded Items</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

interface CertificateViewSkeletonProps {
  hasBackLink?: boolean
}

export function CertificateViewSkeleton({ hasBackLink }: CertificateViewSkeletonProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50/30 dark:from-amber-950/10 dark:via-background dark:to-amber-950/5 py-12 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="flex justify-between items-center mb-8">
          {hasBackLink ? <Skeleton className="h-10 w-32" /> : <div className="h-10" />}
          <Skeleton className="h-10 w-40" />
        </div>

        <Card className="border-4 border-amber-500">
          <CardContent className="p-12 md:p-16">
            <div className="text-center space-y-6">
              <Skeleton className="h-20 w-20 rounded-full mx-auto" />
              <Skeleton className="h-12 w-96 mx-auto" />
              <Skeleton className="h-8 w-64 mx-auto" />
              <Skeleton className="h-10 w-80 mx-auto" />
              <Skeleton className="h-8 w-full max-w-2xl mx-auto" />
              <div className="flex justify-center gap-8 pt-4">
                <Skeleton className="h-16 w-32" />
                <Skeleton className="h-16 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
