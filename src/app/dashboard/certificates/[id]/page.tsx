"use client"

import { useParams } from "next/navigation"
import { CertificateView } from "@/components/certificates/CertificateView"

export default function DashboardCertificatePage() {
  const params = useParams()
  const certificateId = params.id as string | undefined

  if (!certificateId) {
    return null
  }

  return (
    <CertificateView
      certificateId={certificateId}
      backHref="/dashboard/certificates"
      backLabel="Back to Certificates"
    />
  )
}
