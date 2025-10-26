"use client"

import { useParams, useSearchParams } from "next/navigation"
import { CertificateView } from "@/components/certificates/CertificateView"

export default function PublicCertificatePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const certificateId = params.id as string | undefined
  const source = searchParams.get("source")

  if (!certificateId) {
    return null
  }

  const backHref = source === "dashboard" ? "/dashboard/certificates" : undefined
  const backLabel = source === "dashboard" ? "Back to Certificates" : "Back"

  return (
    <CertificateView
      certificateId={certificateId}
      backHref={backHref}
      backLabel={backHref ? backLabel : undefined}
      verificationPath="/certificates"
    />
  )
}
